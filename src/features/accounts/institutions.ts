export interface Institution {
  id: string;
  displayName: string;
  brandColor: string;
  logoPath: string;
}

export const institutions: readonly Institution[] = [
  { id: 'trading212', displayName: 'Trading 212', brandColor: '#00A9E0', logoPath: '/institutions/trading212.png' },
  { id: 'trade_republic', displayName: 'Trade Republic', brandColor: '#111111', logoPath: '/institutions/trade-republic.svg' },
  { id: 'revolut', displayName: 'Revolut', brandColor: '#0666EB', logoPath: '/institutions/revolut.png' },
  { id: 'cgd', displayName: 'Caixa Geral de Depósitos', brandColor: '#CC0033', logoPath: '/institutions/cgd.svg' },
  { id: 'moey', displayName: 'moey!', brandColor: '#FF6A13', logoPath: '/institutions/moey.svg' },
  { id: 'bpi', displayName: 'BPI', brandColor: '#0A5EA6', logoPath: '/institutions/bpi.svg' },
  { id: 'millennium', displayName: 'Millennium bcp', brandColor: '#D6001C', logoPath: '/institutions/millennium.svg' },
  { id: 'novo_banco', displayName: 'Novo Banco', brandColor: '#C4161C', logoPath: '/institutions/novo-banco.svg' },
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
