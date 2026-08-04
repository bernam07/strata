export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AccountType = 'investment' | 'cash' | 'liability';
export type TransactionSource = 'manual' | 't212_sync' | 'csv_import';
export type SyncStatus = 'running' | 'success' | 'error';
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
          instrument_id: string | null;
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
          instrument_id?: string | null;
        };
        Update: {
          kind?: TransactionKind;
          amount?: string;
          occurred_at?: string;
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
      instruments: {
        Row: {
          id: string;
          user_id: string;
          isin: string | null;
          ticker: string;
          t212_ticker: string | null;
          name: string;
          currency: string;
          yahoo_symbol: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          isin?: string | null;
          ticker: string;
          t212_ticker?: string | null;
          name: string;
          currency?: string;
        };
        Update: {
          isin?: string | null;
          name?: string;
        };
        Relationships: [];
      };
      provider_credentials: {
        Row: {
          user_id: string;
          provider: string;
          secret_id: string;
          use_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          provider: string;
          secret_id: string;
          use_demo?: boolean;
        };
        Update: {
          use_demo?: boolean;
        };
        Relationships: [];
      };
      sync_state: {
        Row: {
          user_id: string;
          provider: string;
          stream: string;
          cursor: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          provider: string;
          stream: string;
          cursor?: string | null;
          updated_at?: string;
        };
        Update: {
          cursor?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      sync_runs: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          status: SyncStatus;
          started_at: string;
          finished_at: string | null;
          inserted_rows: number;
          error_message: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          status?: SyncStatus;
          finished_at?: string | null;
          inserted_rows?: number;
          error_message?: string | null;
        };
        Update: {
          status?: SyncStatus;
          finished_at?: string | null;
          inserted_rows?: number;
          error_message?: string | null;
        };
        Relationships: [];
      };
      prices: {
        Row: {
          id: string;
          user_id: string;
          instrument_id: string;
          as_of: string;
          close: string;
          currency: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          instrument_id: string;
          as_of: string;
          close: string;
          currency?: string;
        };
        Update: {
          close?: string;
          currency?: string;
        };
        Relationships: [];
      };
      fx_rates: {
        Row: {
          base: string;
          quote: string;
          as_of: string;
          rate: string;
          created_at: string;
        };
        Insert: {
          base: string;
          quote: string;
          as_of: string;
          rate: string;
        };
        Update: {
          rate?: string;
        };
        Relationships: [];
      };
      broker_accounts: {
        Row: {
          user_id: string;
          provider: string;
          free: string;
          invested: string;
          ppl: string;
          total: string;
          currency: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          provider: string;
          free?: string;
          invested?: string;
          ppl?: string;
          total?: string;
          currency?: string;
        };
        Update: {
          free?: string;
          invested?: string;
          ppl?: string;
          total?: string;
        };
        Relationships: [];
      };
      watchlist: {
        Row: {
          user_id: string;
          symbol: string;
          name: string;
          currency: string;
          added_at: string;
        };
        Insert: {
          user_id?: string;
          symbol: string;
          name: string;
          currency?: string;
        };
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      widget_tokens: {
        Row: {
          user_id: string;
          token: string;
          created_at: string;
        };
        Insert: {
          user_id?: string;
          token: string;
        };
        Update: {
          token?: string;
        };
        Relationships: [];
      };
      holdings: {
        Row: {
          user_id: string;
          instrument_id: string;
          quantity: string;
          average_price: string;
          current_price: string;
          previous_close: string | null;
          currency: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          instrument_id: string;
          quantity: string;
          average_price: string;
          current_price: string;
          previous_close?: string | null;
          currency?: string;
        };
        Update: {
          quantity?: string;
          average_price?: string;
          current_price?: string;
          previous_close?: string | null;
        };
        Relationships: [];
      };
      net_worth_snapshots: {
        Row: {
          user_id: string;
          as_of: string;
          net: number;
          assets: number;
          liabilities: number;
          investments: number;
          created_at: string;
        };
        Insert: {
          user_id?: string;
          as_of: string;
          net: number;
          assets: number;
          liabilities: number;
          investments?: number;
        };
        Update: {
          net?: number;
          assets?: number;
          liabilities?: number;
          investments?: number;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          net_worth_goal: number | null;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          net_worth_goal?: number | null;
        };
        Update: {
          net_worth_goal?: number | null;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          parent_id: string | null;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          parent_id?: string | null;
          name: string;
        };
        Update: {
          parent_id?: string | null;
          name?: string;
        };
        Relationships: [];
      };
      transaction_categories: {
        Row: {
          transaction_id: string;
          user_id: string;
          category_id: string;
          updated_at: string;
        };
        Insert: {
          transaction_id: string;
          user_id?: string;
          category_id: string;
        };
        Update: {
          category_id?: string;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          user_id: string;
          category_id: string;
          monthly_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          category_id: string;
          monthly_limit: number;
        };
        Update: {
          monthly_limit?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      upsert_prices: {
        Args: { p_rows: Json };
        Returns: number;
      };
      upsert_fx_rates: {
        Args: { p_rows: Json };
        Returns: number;
      };
      replace_holdings: {
        Args: { p_user: string; p_rows: Json };
        Returns: number;
      };
      upsert_broker_cash: {
        Args: {
          p_user: string;
          p_provider: string;
          p_free: number;
          p_invested: number;
          p_ppl: number;
          p_total: number;
        };
        Returns: undefined;
      };
      reset_t212_sync: {
        Args: Record<never, never>;
        Returns: undefined;
      };
      clear_sync_history: {
        Args: Record<never, never>;
        Returns: undefined;
      };
      create_widget_token: {
        Args: Record<never, never>;
        Returns: string;
      };
      set_t212_api_key: {
        Args: { p_key: string; p_secret: string; p_use_demo?: boolean };
        Returns: undefined;
      };
      remove_t212_api_key: {
        Args: Record<never, never>;
        Returns: undefined;
      };
      provider_secret: {
        Args: { p_user: string; p_provider: string };
        Returns: { secret: string; use_demo: boolean }[];
      };
      ingest_transactions: {
        Args: { p_rows: Json };
        Returns: number;
      };
    };
    Enums: {
      account_type: AccountType;
      transaction_source: TransactionSource;
      transaction_kind: TransactionKind;
      sync_status: SyncStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}
