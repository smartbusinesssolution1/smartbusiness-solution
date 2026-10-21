/**
 * Standard corporate departments for employee allocation and filtering
 */
export const STANDARD_DEPARTMENTS = [
  'Administration',
  'Customer Support',
  'Engineering',
  'Field Operations',
  'Finance & Accounting',
  'Human Resources',
  'Information Technology',
  'Legal & Compliance',
  'Logistics & Supply Chain',
  'Marketing',
  'Operations',
  'Product & Design',
  'Quality Assurance',
  'Sales',
  'Security & Facilities',
] as const;

export type StandardDepartment = (typeof STANDARD_DEPARTMENTS)[number];
