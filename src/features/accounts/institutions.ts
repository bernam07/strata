export interface Institution {
  id: string;
  displayName: string;
  brandColor: string;
  logoPath: string;
}

export const institutions: readonly Institution[] = [
  { id: 'trading212', displayName: 'Trading 212', brandColor: '#00A9E0', logoPath: '/institutions/trading212.png' },
  { id: 'xtb', displayName: 'XTB', brandColor: '#E30613', logoPath: '/institutions/xtb.png' },
  { id: 'trade_republic', displayName: 'Trade Republic', brandColor: '#111111', logoPath: '/institutions/trade-republic.svg' },
  { id: 'revolut', displayName: 'Revolut', brandColor: '#0666EB', logoPath: '/institutions/revolut.png' },
  { id: 'cgd', displayName: 'Caixa Geral de Depósitos', brandColor: '#0071B9', logoPath: '/institutions/cgd.svg' },
  { id: 'moey', displayName: 'moey!', brandColor: '#8AD82B', logoPath: '/institutions/moey.png' },
  { id: 'bpi', displayName: 'BPI', brandColor: '#EF5B25', logoPath: '/institutions/bpi.png' },
  { id: 'millennium', displayName: 'Millennium bcp', brandColor: '#D1005D', logoPath: '/institutions/millennium.svg' },
  { id: 'novo_banco', displayName: 'Novo Banco', brandColor: '#00807A', logoPath: '/institutions/novo-banco.png' },
  { id: 'santander', displayName: 'Santander', brandColor: '#EC0000', logoPath: '/institutions/santander.svg' },
  { id: 'activobank', displayName: 'ActivoBank', brandColor: '#00B0AA', logoPath: '/institutions/activobank.png' },
  { id: 'edenred', displayName: 'Edenred', brandColor: '#F72717', logoPath: '/institutions/edenred.png' },
  { id: 'cash', displayName: 'Physical cash', brandColor: '#6B7280', logoPath: '/institutions/cash.svg' },
];

const byId = new Map(institutions.map((entry) => [entry.id, entry]));

export const getInstitution = (id: string): Institution =>
  byId.get(id) ?? {
    id,
    displayName: id,
    brandColor: '#6B7280',
    logoPath: '',
  };

export const monogram = (displayName: string): string =>
  displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
