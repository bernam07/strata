export type AccountType = 'investment' | 'cash' | 'liability';
export type TransactionSource = 'manual' | 't212_sync' | 'csv_import';
export type TransactionKind =
  | 'deposit'
  | 'withdrawal'
  | 'expense'
  | 'income'
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'fee'
  | 'interest'
  | 'transfer'
  | 'adjustment';

export interface Database {
  public: {
    Tables: {
      institutions: {
        Row: {
          id: string;
          display_name: string;
          brand_color: string;
          logo_path: string;
          sort_order: number;
        };
        Insert: {
          id: string;
          display_name: string;
          brand_color: string;
          logo_path: string;
          sort_order?: number;
        };
        Update: {
          display_name?: string;
          brand_color?: string;
          logo_path?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          institution_id: string;
          name: string;
          type: AccountType;
          currency: string;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          institution_id: string;
          name: string;
          type: AccountType;
          currency?: string;
          archived_at?: string | null;
        };
        Update: {
          name?: string;
          type?: AccountType;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'accounts_institution_id_fkey';
            columns: ['institution_id'];
            referencedRelation: 'institutions';
            referencedColumns: ['id'];
          },
        ];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          kind: TransactionKind;
          amount: string;
          quantity: string | null;
          currency: string;
          fx_rate: string;
          occurred_at: string;
          note: string | null;
          source: TransactionSource;
          external_id: string | null;
          transfer_group_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          account_id: string;
          kind: TransactionKind;
          amount: string;
          quantity?: string | null;
          currency?: string;
          fx_rate?: string;
          occurred_at: string;
          note?: string | null;
          source?: TransactionSource;
          external_id?: string | null;
          transfer_group_id?: string | null;
        };
        Update: {
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'transactions_account_id_user_id_fkey';
            columns: ['account_id', 'user_id'];
            referencedRelation: 'accounts';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      account_type: AccountType;
      transaction_source: TransactionSource;
      transaction_kind: TransactionKind;
    };
    CompositeTypes: Record<never, never>;
  };
}
