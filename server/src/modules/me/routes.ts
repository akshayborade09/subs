import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../platform/db/index.js';
import { requireAuth } from '../../http/auth-plugin.js';
import { maskPhone } from '../auth/phone.js';
import {
  checkServiceability,
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
} from '../address/service.js';
import { completeStep, getDraft, ONBOARDING_STEPS } from '../onboarding/service.js';
import { todayIn } from '../../platform/time.js';

const Pincode = z.string().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code');

const AddressBody = z.object({
  label: z.enum(['home', 'office', 'other']).default('home'),
  buildingType: z.enum(['apartment', 'house', 'office', 'other']).nullish(),
  flatOrHouse: z.string().max(120).nullish(),
  buildingOrSociety: z.string().max(200).nullish(),
  line1: z.string().min(1).max(300),
  line2: z.string().max(300).nullish(),
  landmark: z.string().max(200).nullish(),
  deliveryInstructions: z.string().max(500).nullish(),
  city: z.string().min(1).max(120),
  state: z.string().min(1).max(120),
  pincode: Pincode,
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  makeDefault: z.boolean().optional(),
});

const AddressResponse = z.object({
  id: z.string().uuid(),
  label: z.string(),
  line1: z.string(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
  isDefault: z.boolean(),
  isServiceable: z.boolean(),
});

type AddressRow = Awaited<ReturnType<typeof listAddresses>>[number];
const toAddressResponse = (row: AddressRow) => ({
  id: row.id,
  label: row.label,
  line1: row.line1,
  city: row.city,
  state: row.state,
  pincode: row.pincode,
  isDefault: row.is_default,
  isServiceable: row.is_serviceable,
});

export async function meRoutes(app: FastifyInstance): Promise<void> {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.get(
    '/me/profile',
    {
      schema: {
        tags: ['profile'],
        summary: 'Account identity. The WhatsApp number is read-only.',
        response: {
          200: z.object({
            id: z.string().uuid(),
            fullName: z.string().nullable(),
            dateOfBirth: z.string().nullable(),
            gender: z.string().nullable(),
            phoneNumberMasked: z.string(),
            phoneVerified: z.boolean(),
            referralCode: z.string().nullable(),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      const user = await db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', auth.userId)
        .executeTakeFirstOrThrow();

      return {
        id: user.id,
        fullName: user.full_name,
        dateOfBirth: user.date_of_birth,
        gender: user.gender,
        phoneNumberMasked: maskPhone(user.phone_number, user.phone_country_code),
        phoneVerified: user.phone_verified_at !== null,
        referralCode: user.referral_code,
      };
    },
  );

  route.patch(
    '/me/profile',
    {
      schema: {
        tags: ['profile'],
        summary: 'Update personal information (never the verified phone number)',
        body: z.object({
          fullName: z.string().min(2).max(120).optional(),
          dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          gender: z.enum(['woman', 'man', 'non_binary', 'prefer_not_to_say']).optional(),
        }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      const { fullName, dateOfBirth, gender } = request.body;
      await db
        .updateTable('users')
        .set({
          ...(fullName !== undefined ? { full_name: fullName } : {}),
          ...(dateOfBirth !== undefined ? { date_of_birth: dateOfBirth } : {}),
          ...(gender !== undefined ? { gender } : {}),
        })
        .where('id', '=', auth.userId)
        .execute();
      return { ok: true as const };
    },
  );

  route.get(
    '/me/onboarding',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Resume point for the 14-step setup wizard',
        response: {
          200: z.object({
            status: z.string(),
            lastCompletedStep: z.string().nullable(),
            resumeStep: z.string(),
            payload: z.record(z.unknown()),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      const draft = await getDraft(auth.userId);
      return {
        status: draft.status,
        lastCompletedStep: draft.last_completed_step,
        resumeStep: draft.resume_step,
        payload: draft.payload as Record<string, unknown>,
      };
    },
  );

  route.post(
    '/me/onboarding/step',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Record a completed wizard step and advance the resume point',
        body: z.object({
          step: z.enum(ONBOARDING_STEPS as unknown as [string, ...string[]]),
          payload: z.record(z.unknown()).default({}),
        }),
        response: {
          200: z.object({ resumeStep: z.string(), status: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      const draft = await completeStep(
        auth.userId,
        request.body.step as (typeof ONBOARDING_STEPS)[number],
        request.body.payload,
      );
      return { resumeStep: draft.resume_step, status: draft.status };
    },
  );

  route.post(
    '/serviceability/check',
    {
      schema: {
        tags: ['address'],
        summary: 'Is this PIN code deliverable?',
        body: z.object({ pincode: Pincode }),
        response: {
          200: z.object({
            pincode: z.string(),
            serviceable: z.boolean(),
            city: z.string().nullable(),
            state: z.string().nullable(),
            message: z.string(),
          }),
        },
      },
    },
    async (request) => checkServiceability(request.body.pincode),
  );

  route.get(
    '/me/addresses',
    {
      schema: {
        tags: ['address'],
        summary: 'Saved delivery addresses',
        response: { 200: z.object({ addresses: z.array(AddressResponse) }) },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      const rows = await listAddresses(auth.userId);
      return { addresses: rows.map(toAddressResponse) };
    },
  );

  route.post(
    '/me/addresses',
    {
      schema: {
        tags: ['address'],
        summary: 'Add a delivery address',
        body: AddressBody,
        response: { 201: AddressResponse },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      const row = await createAddress(auth.userId, request.body);
      return reply.status(201).send(toAddressResponse(row));
    },
  );

  route.post(
    '/me/addresses/:addressId/default',
    {
      schema: {
        tags: ['address'],
        summary: 'Set an address as the default',
        params: z.object({ addressId: z.string().uuid() }),
        response: { 200: AddressResponse },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      const row = await setDefaultAddress(auth.userId, request.params.addressId);
      return toAddressResponse(row);
    },
  );

  route.delete(
    '/me/addresses/:addressId',
    {
      schema: {
        tags: ['address'],
        summary: 'Delete an address, unless upcoming deliveries depend on it',
        params: z.object({ addressId: z.string().uuid() }),
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return deleteAddress(auth.userId, request.params.addressId, todayIn(new Date()));
    },
  );
}
