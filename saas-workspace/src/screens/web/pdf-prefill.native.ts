import type { CreateClientInput } from './types';

type AgreementPrefill = Pick<
  CreateClientInput,
  'contractMonths' | 'contractStartsOn' | 'monthlyDeliverables' | 'monthlyPrice' | 'totalContractValue'
>;

export async function prefillAgreementFromPdf(_file: File): Promise<Partial<AgreementPrefill>> {
  throw new Error('PDF agreement parsing is available in the web app only. Enter the agreement details manually.');
}
