export type LifecycleStateId =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'
  | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U';

export type LifecycleGroup = 'Entry and onboarding' | 'Trial' | 'Subscription' | 'Recovery and delivery';
export type LifecycleDestination = 'stories' | 'auth' | 'onboarding' | 'trial_home' | 'state_preview';

export type LifecycleDefinition = {
  id: LifecycleStateId;
  group: LifecycleGroup;
  title: string;
  summary: string;
  entry: string;
  primaryAction: string;
  secondaryAction?: string;
  destination: LifecycleDestination;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
};

export const lifecycleDefinitions: LifecycleDefinition[] = [
  { id: 'A', group: 'Entry and onboarding', title: 'New user, signed out', summary: 'First launch before authentication.', entry: 'Splash and onboarding stories', primaryAction: 'Get Started', destination: 'stories', tone: 'neutral' },
  { id: 'B', group: 'Entry and onboarding', title: 'Authentication incomplete', summary: 'Phone or OTP verification must resume.', entry: 'Create Account or Verify Number', primaryAction: 'Continue authentication', destination: 'auth', tone: 'warning' },
  { id: 'C', group: 'Entry and onboarding', title: 'Onboarding incomplete', summary: 'Resume the last incomplete setup step.', entry: 'Last incomplete onboarding screen', primaryAction: 'Continue setup', destination: 'onboarding', tone: 'warning' },
  { id: 'D', group: 'Trial', title: 'Trial payment pending', summary: 'Payment was initiated but is not confirmed.', entry: 'Trial payment recovery', primaryAction: 'Go to Home', destination: 'state_preview', tone: 'warning' },
  { id: 'T', group: 'Trial', title: 'Trial payment pending + success', summary: 'Preview the pending payment loader resolving into confirmation.', entry: 'Payment status transition', primaryAction: 'Checking Payment', destination: 'state_preview', tone: 'warning' },
  { id: 'U', group: 'Trial', title: 'Trial payment success', summary: 'Payment is confirmed and the trial can be scheduled.', entry: 'Payment success confirmation', primaryAction: 'Continue to Home', destination: 'state_preview', tone: 'success' },
  { id: 'E', group: 'Trial', title: 'Trial payment failed', summary: 'Payment failed and the trial has not started.', entry: 'Payment recovery', primaryAction: 'Retry Payment', secondaryAction: 'Change Payment Method', destination: 'state_preview', tone: 'danger' },
  { id: 'F', group: 'Trial', title: 'Trial scheduled', summary: 'Payment succeeded and the first meal is in the future.', entry: 'Pre-trial Home', primaryAction: 'Review Trial', destination: 'trial_home', tone: 'success' },
  { id: 'G', group: 'Trial', title: 'Trial active, no subscription', summary: 'Five-day trial is running with conversion available.', entry: 'Trial Home', primaryAction: 'Avail Subscription', destination: 'trial_home', tone: 'success' },
  { id: 'H', group: 'Trial', title: 'Trial active, subscription purchased', summary: 'Trial remains active and the paid plan starts later.', entry: 'Trial Home', primaryAction: 'Explore My Plan', destination: 'trial_home', tone: 'success' },
  { id: 'I', group: 'Trial', title: 'Trial completed, no subscription', summary: 'Trial is finished and conversion is the priority.', entry: 'Conversion Home', primaryAction: 'Choose Subscription', secondaryAction: 'Review Trial Meals', destination: 'trial_home', tone: 'warning' },
  { id: 'J', group: 'Subscription', title: 'Subscription scheduled', summary: 'Subscription is paid and begins on a future date.', entry: 'Pre-subscription Home', primaryAction: 'Explore My Plan', destination: 'trial_home', tone: 'success' },
  { id: 'K', group: 'Subscription', title: 'Subscription active', summary: 'Normal subscriber experience with this week’s selected meals.', entry: 'Subscriber Home', primaryAction: 'View Meal Details', destination: 'trial_home', tone: 'success' },
  { id: 'L', group: 'Subscription', title: 'No meal today', summary: 'Subscription is active without a delivery today.', entry: 'Subscriber Home', primaryAction: 'View Next Delivery', destination: 'trial_home', tone: 'neutral' },
  { id: 'M', group: 'Subscription', title: 'Subscription paused', summary: 'Deliveries are paused until the saved resume date.', entry: 'Paused Home', primaryAction: 'Resume Subscription', destination: 'trial_home', tone: 'warning' },
  { id: 'N', group: 'Subscription', title: 'Cancelled, active until end date', summary: 'Cancellation is recorded while paid meals continue.', entry: 'Subscriber Home', primaryAction: 'Reactivate Subscription', destination: 'trial_home', tone: 'warning' },
  { id: 'O', group: 'Subscription', title: 'Subscription expired', summary: 'The plan ended while history remains available.', entry: 'Renewal Home', primaryAction: 'Renew Subscription', secondaryAction: 'View Previous Plan', destination: 'trial_home', tone: 'neutral' },
  { id: 'P', group: 'Recovery and delivery', title: 'Renewal payment failed', summary: 'Future unpaid meals need payment recovery.', entry: 'Subscriber Home with payment banner', primaryAction: 'Update Payment Method', secondaryAction: 'Retry Payment', destination: 'trial_home', tone: 'danger' },
  { id: 'Q', group: 'Recovery and delivery', title: 'Delivery delayed', summary: 'An active delivery is running behind schedule.', entry: 'Subscriber Home with delayed meal', primaryAction: 'Track Update', secondaryAction: 'Contact Support', destination: 'trial_home', tone: 'warning' },
  { id: 'R', group: 'Recovery and delivery', title: 'Delivery failed or address issue', summary: 'Delivery needs an address fix or support resolution.', entry: 'Subscriber Home with issue card', primaryAction: 'Fix Address', secondaryAction: 'Contact Support', destination: 'trial_home', tone: 'danger' },
  { id: 'S', group: 'Recovery and delivery', title: 'Offline', summary: 'Cached information is available without connectivity.', entry: 'Last cached Home state', primaryAction: 'Try Again', destination: 'trial_home', tone: 'neutral' },
];

export type LifecycleMachineState = {
  selectedState: LifecycleStateId | null;
  destination: 'selector' | LifecycleDestination;
};

export type LifecycleMachineEvent =
  | { type: 'SELECT_STATE'; stateId: LifecycleStateId }
  | { type: 'OPEN_SELECTOR' };

export const initialLifecycleMachineState: LifecycleMachineState = { selectedState: null, destination: 'selector' };

export function lifecycleMachineReducer(state: LifecycleMachineState, event: LifecycleMachineEvent): LifecycleMachineState {
  if (event.type === 'OPEN_SELECTOR') return initialLifecycleMachineState;
  const definition = lifecycleDefinitions.find((item) => item.id === event.stateId);
  if (!definition) return state;
  return { selectedState: definition.id, destination: definition.destination };
}

export function getLifecycleDefinition(id: LifecycleStateId | null) {
  return lifecycleDefinitions.find((item) => item.id === id);
}
