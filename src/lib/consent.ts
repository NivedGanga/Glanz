export function shouldAnalyseRequestPhoto(flagOn: boolean, consent: { withdrawnAt: Date | null } | null) {
  return flagOn && consent !== null && consent.withdrawnAt === null;
}
