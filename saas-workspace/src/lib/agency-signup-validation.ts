export type AgencySignupInput = {
  agencyName: string;
  fullName: string;
  email: string;
  password: string;
  confirmation: string;
};

export function normalizeAgencySignup(input: AgencySignupInput) {
  const agencyName = input.agencyName.trim();
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  if (agencyName.length < 2 || agencyName.length > 120) {
    throw new Error('Use an agency name between 2 and 120 characters.');
  }
  if (fullName.length < 2 || fullName.length > 120) {
    throw new Error('Use your full name, between 2 and 120 characters.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.');
  }
  if (input.password.length < 10) throw new Error('Use a password with at least 10 characters.');
  if (input.password !== input.confirmation) throw new Error('The passwords do not match.');
  return { agencyName, fullName, email, password: input.password };
}
