export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      aircraft: {
        Row: {
          active: boolean;
          callsign: string;
          created_at: string;
          id: string;
          identificacao: string;
          modelo: string;
          sort_order: number;
          tipo: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          callsign?: string;
          created_at?: string;
          id?: string;
          identificacao: string;
          modelo?: string;
          sort_order?: number;
          tipo?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          callsign?: string;
          created_at?: string;
          id?: string;
          identificacao?: string;
          modelo?: string;
          sort_order?: number;
          tipo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      annotator_activations: {
        Row: {
          created_at: string;
          hora: string;
          id: string;
          observacao: string;
          op_date: string;
          ordem: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          hora?: string;
          id?: string;
          observacao?: string;
          op_date?: string;
          ordem?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          hora?: string;
          id?: string;
          observacao?: string;
          op_date?: string;
          ordem?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      annotator_flights: {
        Row: {
          aeronave: string;
          al_1p: string;
          al_profile_id: string | null;
          callsign: string;
          created_at: string;
          dep_time: string;
          id: string;
          in_2p: string;
          land_time: string;
          missao: string;
          observacoes: string;
          op_date: string;
          qtd: number;
          resultado: string;
          sort_order: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          aeronave?: string;
          al_1p?: string;
          al_profile_id?: string | null;
          callsign?: string;
          created_at?: string;
          dep_time?: string;
          id?: string;
          in_2p?: string;
          land_time?: string;
          missao?: string;
          observacoes?: string;
          op_date?: string;
          qtd?: number;
          resultado?: string;
          sort_order?: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          aeronave?: string;
          al_1p?: string;
          al_profile_id?: string | null;
          callsign?: string;
          created_at?: string;
          dep_time?: string;
          id?: string;
          in_2p?: string;
          land_time?: string;
          missao?: string;
          observacoes?: string;
          op_date?: string;
          qtd?: number;
          resultado?: string;
          sort_order?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "annotator_flights_al_profile_id_fkey";
            columns: ["al_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          active: boolean;
          archived_at: string | null;
          created_at: string;
          id: string;
          message: string;
          op_date: string;
          priority: string;
          responsavel: string;
          scope: string;
          time_ref: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          message?: string;
          op_date?: string;
          priority?: string;
          responsavel?: string;
          scope?: string;
          time_ref?: string;
          title?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          message?: string;
          op_date?: string;
          priority?: string;
          responsavel?: string;
          scope?: string;
          time_ref?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          updated_at: string;
          value: string;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value?: string;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: string;
        };
        Relationships: [];
      };
      availability_entries: {
        Row: {
          created_at: string;
          id: string;
          observacao: string;
          op_date: string;
          profile_id: string;
          status: string;
          updated_at: string;
          week_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          observacao?: string;
          op_date: string;
          profile_id: string;
          status?: string;
          updated_at?: string;
          week_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          observacao?: string;
          op_date?: string;
          profile_id?: string;
          status?: string;
          updated_at?: string;
          week_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_entries_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "availability_entries_week_id_fkey";
            columns: ["week_id"];
            isOneToOne: false;
            referencedRelation: "availability_weeks";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_weeks: {
        Row: {
          created_at: string;
          days: string[];
          id: string;
          open: boolean;
          updated_at: string;
          week_end: string;
          week_start: string;
        };
        Insert: {
          created_at?: string;
          days?: string[];
          id?: string;
          open?: boolean;
          updated_at?: string;
          week_end: string;
          week_start: string;
        };
        Update: {
          created_at?: string;
          days?: string[];
          id?: string;
          open?: boolean;
          updated_at?: string;
          week_end?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      calendar_categories: {
        Row: {
          active: boolean;
          cor: string;
          created_at: string;
          id: string;
          nome: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          cor?: string;
          created_at?: string;
          id?: string;
          nome: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          cor?: string;
          created_at?: string;
          id?: string;
          nome?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      calendar_events: {
        Row: {
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          created_by_name: string;
          description: string;
          diretoria_id: string | null;
          end_date: string | null;
          event_date: string;
          id: string;
          responsavel: string;
          time_ref: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          description?: string;
          diretoria_id?: string | null;
          end_date?: string | null;
          event_date: string;
          id?: string;
          responsavel?: string;
          time_ref?: string;
          title?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          description?: string;
          diretoria_id?: string | null;
          end_date?: string | null;
          event_date?: string;
          id?: string;
          responsavel?: string;
          time_ref?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_events_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "calendar_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_events_diretoria_id_fkey";
            columns: ["diretoria_id"];
            isOneToOne: false;
            referencedRelation: "diretorias";
            referencedColumns: ["id"];
          },
        ];
      };
      callsigns: {
        Row: {
          active: boolean;
          aircraft_id: string | null;
          created_at: string;
          id: string;
          nome: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          aircraft_id?: string | null;
          created_at?: string;
          id?: string;
          nome: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          aircraft_id?: string | null;
          created_at?: string;
          id?: string;
          nome?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "callsigns_aircraft_id_fkey";
            columns: ["aircraft_id"];
            isOneToOne: false;
            referencedRelation: "aircraft";
            referencedColumns: ["id"];
          },
        ];
      };
      change_log: {
        Row: {
          action: string;
          area: string;
          created_at: string;
          details: Json;
          entity: string;
          entity_id: string;
          entity_label: string;
          field: string;
          field_label: string;
          id: string;
          new_value: string;
          old_value: string;
          op_date: string | null;
          reverted_at: string | null;
          reverted_by: string;
          user_id: string | null;
          user_tag: string;
        };
        Insert: {
          action?: string;
          area: string;
          created_at?: string;
          details?: Json;
          entity?: string;
          entity_id?: string;
          entity_label?: string;
          field?: string;
          field_label?: string;
          id?: string;
          new_value?: string;
          old_value?: string;
          op_date?: string | null;
          reverted_at?: string | null;
          reverted_by?: string;
          user_id?: string | null;
          user_tag?: string;
        };
        Update: {
          action?: string;
          area?: string;
          created_at?: string;
          details?: Json;
          entity?: string;
          entity_id?: string;
          entity_label?: string;
          field?: string;
          field_label?: string;
          id?: string;
          new_value?: string;
          old_value?: string;
          op_date?: string | null;
          reverted_at?: string | null;
          reverted_by?: string;
          user_id?: string | null;
          user_tag?: string;
        };
        Relationships: [];
      };
      commerce_categories: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          nome: string;
          parent_id: string | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          nome: string;
          parent_id?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          nome?: string;
          parent_id?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commerce_categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "commerce_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      commerce_products: {
        Row: {
          active: boolean;
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          created_by_name: string;
          descricao: string;
          id: string;
          nome: string;
          photo_path: string;
          preco: number;
          stock_enabled: boolean;
          stock_min: number;
          stock_qty: number;
          subcategory_id: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          descricao?: string;
          id?: string;
          nome: string;
          photo_path?: string;
          preco?: number;
          stock_enabled?: boolean;
          stock_min?: number;
          stock_qty?: number;
          subcategory_id?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          descricao?: string;
          id?: string;
          nome?: string;
          photo_path?: string;
          preco?: number;
          stock_enabled?: boolean;
          stock_min?: number;
          stock_qty?: number;
          subcategory_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commerce_products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "commerce_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commerce_products_subcategory_id_fkey";
            columns: ["subcategory_id"];
            isOneToOne: false;
            referencedRelation: "commerce_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      commerce_purchase_items: {
        Row: {
          category_name: string;
          created_at: string;
          id: string;
          product_id: string | null;
          product_name: string;
          purchase_id: string;
          qty: number;
          subcategory_name: string;
          total: number;
          unit_price: number;
        };
        Insert: {
          category_name?: string;
          created_at?: string;
          id?: string;
          product_id?: string | null;
          product_name?: string;
          purchase_id: string;
          qty?: number;
          subcategory_name?: string;
          total?: number;
          unit_price?: number;
        };
        Update: {
          category_name?: string;
          created_at?: string;
          id?: string;
          product_id?: string | null;
          product_name?: string;
          purchase_id?: string;
          qty?: number;
          subcategory_name?: string;
          total?: number;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "commerce_purchase_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "commerce_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commerce_purchase_items_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: false;
            referencedRelation: "commerce_purchases";
            referencedColumns: ["id"];
          },
        ];
      };
      commerce_purchases: {
        Row: {
          buyer_profile_id: string | null;
          buyer_tag: string;
          created_at: string;
          created_by: string | null;
          created_by_name: string;
          id: string;
          observacao: string;
          purchased_at: string;
          total: number;
          updated_at: string;
        };
        Insert: {
          buyer_profile_id?: string | null;
          buyer_tag?: string;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          id?: string;
          observacao?: string;
          purchased_at?: string;
          total?: number;
          updated_at?: string;
        };
        Update: {
          buyer_profile_id?: string | null;
          buyer_tag?: string;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          id?: string;
          observacao?: string;
          purchased_at?: string;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commerce_purchases_buyer_profile_id_fkey";
            columns: ["buyer_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      deleted_members: {
        Row: {
          deleted_at: string;
          deleted_by: string;
          email: string;
          esquadrao: string;
          full_name: string;
          id: string;
          posto: string;
          tri: string;
          war_name: string;
        };
        Insert: {
          deleted_at?: string;
          deleted_by?: string;
          email?: string;
          esquadrao?: string;
          full_name?: string;
          id: string;
          posto?: string;
          tri?: string;
          war_name?: string;
        };
        Update: {
          deleted_at?: string;
          deleted_by?: string;
          email?: string;
          esquadrao?: string;
          full_name?: string;
          id?: string;
          posto?: string;
          tri?: string;
          war_name?: string;
        };
        Relationships: [];
      };
      diretoria_assignments: {
        Row: {
          created_at: string;
          diretoria_id: string;
          id: string;
          profile_id: string;
          tipo: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          diretoria_id: string;
          id?: string;
          profile_id: string;
          tipo?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          diretoria_id?: string;
          id?: string;
          profile_id?: string;
          tipo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "diretoria_assignments_diretoria_id_fkey";
            columns: ["diretoria_id"];
            isOneToOne: false;
            referencedRelation: "diretorias";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "diretoria_assignments_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      diretoria_items: {
        Row: {
          content: string;
          created_at: string;
          created_by: string | null;
          created_by_name: string;
          diretoria_id: string;
          id: string;
          scope: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          content?: string;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          diretoria_id: string;
          id?: string;
          scope?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          diretoria_id?: string;
          id?: string;
          scope?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "diretoria_items_diretoria_id_fkey";
            columns: ["diretoria_id"];
            isOneToOne: false;
            referencedRelation: "diretorias";
            referencedColumns: ["id"];
          },
        ];
      };
      diretorias: {
        Row: {
          created_at: string;
          id: string;
          nome: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nome: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nome?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          created_by_name: string;
          description: string;
          doc_date: string;
          external_url: string;
          file_name: string;
          file_path: string;
          id: string;
          keywords: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          description?: string;
          doc_date?: string;
          external_url?: string;
          file_name?: string;
          file_path?: string;
          id?: string;
          keywords?: string;
          title?: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          description?: string;
          doc_date?: string;
          external_url?: string;
          file_name?: string;
          file_path?: string;
          id?: string;
          keywords?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      duty_roster: {
        Row: {
          created_at: string;
          funcao: string;
          id: string;
          observacao: string;
          op_date: string;
          profile_id: string | null;
          responsavel: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          funcao: string;
          id?: string;
          observacao?: string;
          op_date: string;
          profile_id?: string | null;
          responsavel?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          funcao?: string;
          id?: string;
          observacao?: string;
          op_date?: string;
          profile_id?: string | null;
          responsavel?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "duty_roster_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      fases: {
        Row: {
          cor: string;
          created_at: string;
          id: string;
          nome: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          cor?: string;
          created_at?: string;
          id?: string;
          nome: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          cor?: string;
          created_at?: string;
          id?: string;
          nome?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      flight_schedule: {
        Row: {
          aluno: string;
          created_at: string;
          id: string;
          instrutor: string;
          missao: string;
          missao_sugerida: string;
          observacao: string;
          op_date: string;
          origem: string;
          profile_id: string | null;
          sort_order: number;
          time_planned: string;
          updated_at: string;
        };
        Insert: {
          aluno?: string;
          created_at?: string;
          id?: string;
          instrutor?: string;
          missao?: string;
          missao_sugerida?: string;
          observacao?: string;
          op_date: string;
          origem?: string;
          profile_id?: string | null;
          sort_order?: number;
          time_planned?: string;
          updated_at?: string;
        };
        Update: {
          aluno?: string;
          created_at?: string;
          id?: string;
          instrutor?: string;
          missao?: string;
          missao_sugerida?: string;
          observacao?: string;
          op_date?: string;
          origem?: string;
          profile_id?: string | null;
          sort_order?: number;
          time_planned?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flight_schedule_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_categories: {
        Row: {
          active: boolean;
          cor: string;
          created_at: string;
          id: string;
          key: string;
          label: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          cor?: string;
          created_at?: string;
          id?: string;
          key: string;
          label?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          cor?: string;
          created_at?: string;
          id?: string;
          key?: string;
          label?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      mission_category_overrides: {
        Row: {
          category_key: string;
          created_at: string;
          id: string;
          missao_base: string;
          updated_at: string;
        };
        Insert: {
          category_key: string;
          created_at?: string;
          id?: string;
          missao_base: string;
          updated_at?: string;
        };
        Update: {
          category_key?: string;
          created_at?: string;
          id?: string;
          missao_base?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      mission_sequence: {
        Row: {
          categoria: string;
          created_at: string;
          id: string;
          missao: string;
          pane: boolean;
          proxima: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          categoria?: string;
          created_at?: string;
          id?: string;
          missao: string;
          pane?: boolean;
          proxima?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          categoria?: string;
          created_at?: string;
          id?: string;
          missao?: string;
          pane?: boolean;
          proxima?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      op_days: {
        Row: {
          briefing_time: string;
          created_at: string;
          id: string;
          op_date: string;
          updated_at: string;
        };
        Insert: {
          briefing_time?: string;
          created_at?: string;
          id?: string;
          op_date: string;
          updated_at?: string;
        };
        Update: {
          briefing_time?: string;
          created_at?: string;
          id?: string;
          op_date?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      operational_levels: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          nome: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          nome: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          nome?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      estrelarios: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          issued_by: string;
          issued_by_name: string;
          op_date: string;
          reason: string;
          recipient_id: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          issued_by: string;
          issued_by_name?: string;
          op_date?: string;
          reason: string;
          recipient_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          issued_by?: string;
          issued_by_name?: string;
          op_date?: string;
          reason?: string;
          recipient_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pitocador_entries: {
        Row: {
          aeronave: string;
          created_at: string;
          created_by: string | null;
          created_by_name: string;
          flight_id: string | null;
          grau: number | null;
          id: string;
          instrutor_id: string | null;
          instrutor_tag: string;
          minutes: number;
          missao: string;
          observacao: string;
          op_date: string;
          profile_id: string;
          updated_at: string;
        };
        Insert: {
          aeronave?: string;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          flight_id?: string | null;
          grau?: number | null;
          id?: string;
          instrutor_id?: string | null;
          instrutor_tag?: string;
          minutes?: number;
          missao?: string;
          observacao?: string;
          op_date?: string;
          profile_id: string;
          updated_at?: string;
        };
        Update: {
          aeronave?: string;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          flight_id?: string | null;
          grau?: number | null;
          id?: string;
          instrutor_id?: string | null;
          instrutor_tag?: string;
          minutes?: number;
          missao?: string;
          observacao?: string;
          op_date?: string;
          profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pitocador_entries_flight_id_fkey";
            columns: ["flight_id"];
            isOneToOne: false;
            referencedRelation: "annotator_flights";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pitocador_entries_instrutor_id_fkey";
            columns: ["instrutor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pitocador_entries_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string;
          cargo: string;
          created_at: string;
          diretoria: string;
          email: string;
          esquadrao: string;
          fase: string;
          flight_minutes: number;
          full_name: string;
          funcao: string;
          gaivota: string;
          id: string;
          in_pessoal_id: string | null;
          instrutor: boolean;
          missao: string;
          nivel_operacional: string;
          observacao: string;
          opr_cs: string;
          opr_dg: string;
          opr_duo: string;
          ops: number;
          posto: string;
          proxima_missao: string;
          pso: number;
          status: string;
          tri: string;
          turma: string;
          updated_at: string;
          war_name: string;
        };
        Insert: {
          avatar_path?: string;
          cargo?: string;
          created_at?: string;
          diretoria?: string;
          email?: string;
          esquadrao?: string;
          fase?: string;
          flight_minutes?: number;
          full_name?: string;
          funcao?: string;
          gaivota?: string;
          id: string;
          in_pessoal_id?: string | null;
          instrutor?: boolean;
          missao?: string;
          nivel_operacional?: string;
          observacao?: string;
          opr_cs?: string;
          opr_dg?: string;
          opr_duo?: string;
          ops?: number;
          posto?: string;
          proxima_missao?: string;
          pso?: number;
          status?: string;
          tri?: string;
          turma?: string;
          updated_at?: string;
          war_name?: string;
        };
        Update: {
          avatar_path?: string;
          cargo?: string;
          created_at?: string;
          diretoria?: string;
          email?: string;
          esquadrao?: string;
          fase?: string;
          flight_minutes?: number;
          full_name?: string;
          funcao?: string;
          gaivota?: string;
          id?: string;
          in_pessoal_id?: string | null;
          instrutor?: boolean;
          missao?: string;
          nivel_operacional?: string;
          observacao?: string;
          opr_cs?: string;
          opr_dg?: string;
          opr_duo?: string;
          ops?: number;
          posto?: string;
          proxima_missao?: string;
          pso?: number;
          status?: string;
          tri?: string;
          turma?: string;
          updated_at?: string;
          war_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_in_pessoal_id_fkey";
            columns: ["in_pessoal_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      progression_log: {
        Row: {
          created_at: string;
          id: string;
          missao: string;
          op_date: string;
          profile_id: string | null;
          profile_tag: string;
          proxima_missao: string;
          registrado_por: string;
          resultado: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          missao?: string;
          op_date: string;
          profile_id?: string | null;
          profile_tag?: string;
          proxima_missao?: string;
          registrado_por?: string;
          resultado?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          missao?: string;
          op_date?: string;
          profile_id?: string | null;
          profile_tag?: string;
          proxima_missao?: string;
          registrado_por?: string;
          resultado?: string;
        };
        Relationships: [
          {
            foreignKeyName: "progression_log_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      relprevs: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          created_by_name: string;
          external_url: string;
          file_name: string;
          file_path: string;
          id: string;
          keywords: string;
          relprev_date: string;
          summary: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          external_url?: string;
          file_name?: string;
          file_path?: string;
          id?: string;
          keywords?: string;
          relprev_date?: string;
          summary?: string;
          title?: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          external_url?: string;
          file_name?: string;
          file_path?: string;
          id?: string;
          keywords?: string;
          relprev_date?: string;
          summary?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      safety_entries: {
        Row: {
          active: boolean;
          archived_at: string | null;
          content: string;
          created_at: string;
          id: string;
          kind: string;
          op_date: string;
          responsavel: string;
          scope: string;
          time_ref: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          archived_at?: string | null;
          content?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          op_date?: string;
          responsavel?: string;
          scope?: string;
          time_ref?: string;
          title?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          archived_at?: string | null;
          content?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          op_date?: string;
          responsavel?: string;
          scope?: string;
          time_ref?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      supervisao_items: {
        Row: {
          content: string;
          created_at: string;
          created_by: string | null;
          created_by_name: string;
          id: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          content?: string;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      weather_observations: {
        Row: {
          analysis: string;
          ceiling: string;
          classification: string;
          cloud_base: string;
          cloud_cover: string;
          cloud_layers: string;
          cloud_type: string;
          created_at: string;
          created_by: string | null;
          created_by_name: string;
          cumulus_cover: string;
          dewpoint: string;
          extra: string;
          fog: string;
          fog_chance: string;
          fog_obs: string;
          humidity: string;
          id: string;
          last_glider_ground: string;
          observed_time: string;
          op_date: string;
          precipitation: string;
          qnh: string;
          rain_chance: string;
          rain_confidence: string;
          solar_hours: string;
          solar_radiation: string;
          source: string;
          sunrise: string;
          sunset: string;
          temp_max: string;
          temperature: string;
          thermal_condition: string;
          thermals_obs: string;
          thermals_strength: string;
          thermals_top: string;
          tic_temp: string;
          tic_time: string;
          tick: string;
          turbulence: string;
          updated_at: string;
          updated_by_name: string;
          visibility: string;
          wind_dir: string;
          wind_gust: string;
          wind_obs: string;
          wind_period_end: string;
          wind_period_start: string;
          wind_speed: string;
        };
        Insert: {
          analysis?: string;
          ceiling?: string;
          classification?: string;
          cloud_base?: string;
          cloud_cover?: string;
          cloud_layers?: string;
          cloud_type?: string;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          cumulus_cover?: string;
          dewpoint?: string;
          extra?: string;
          fog?: string;
          fog_chance?: string;
          fog_obs?: string;
          humidity?: string;
          id?: string;
          last_glider_ground?: string;
          observed_time?: string;
          op_date: string;
          precipitation?: string;
          qnh?: string;
          rain_chance?: string;
          rain_confidence?: string;
          solar_hours?: string;
          solar_radiation?: string;
          source?: string;
          sunrise?: string;
          sunset?: string;
          temp_max?: string;
          temperature?: string;
          thermal_condition?: string;
          thermals_obs?: string;
          thermals_strength?: string;
          thermals_top?: string;
          tic_temp?: string;
          tic_time?: string;
          tick?: string;
          turbulence?: string;
          updated_at?: string;
          updated_by_name?: string;
          visibility?: string;
          wind_dir?: string;
          wind_gust?: string;
          wind_obs?: string;
          wind_period_end?: string;
          wind_period_start?: string;
          wind_speed?: string;
        };
        Update: {
          analysis?: string;
          ceiling?: string;
          classification?: string;
          cloud_base?: string;
          cloud_cover?: string;
          cloud_layers?: string;
          cloud_type?: string;
          created_at?: string;
          created_by?: string | null;
          created_by_name?: string;
          cumulus_cover?: string;
          dewpoint?: string;
          extra?: string;
          fog?: string;
          fog_chance?: string;
          fog_obs?: string;
          humidity?: string;
          id?: string;
          last_glider_ground?: string;
          observed_time?: string;
          op_date?: string;
          precipitation?: string;
          qnh?: string;
          rain_chance?: string;
          rain_confidence?: string;
          solar_hours?: string;
          solar_radiation?: string;
          source?: string;
          sunrise?: string;
          sunset?: string;
          temp_max?: string;
          temperature?: string;
          thermal_condition?: string;
          thermals_obs?: string;
          thermals_strength?: string;
          thermals_top?: string;
          tic_temp?: string;
          tic_time?: string;
          tick?: string;
          turbulence?: string;
          updated_at?: string;
          updated_by_name?: string;
          visibility?: string;
          wind_dir?: string;
          wind_gust?: string;
          wind_obs?: string;
          wind_period_end?: string;
          wind_period_start?: string;
          wind_speed?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_issue_estrelarios: {
        Args: { _op_date: string; _user_id: string };
        Returns: boolean;
      };
      can_access_diretoria: {
        Args: { _diretoria_id: string; _scope: string; _user_id: string };
        Returns: boolean;
      };
      can_manage_ops: { Args: { _user_id: string }; Returns: boolean };
      estrelarios_estatistica: {
        Args: { _from: string; _to: string };
        Returns: { lancamentos: number; op_date: string; total: number }[];
      };
      reopen_operation: {
        Args: { _op_date: string };
        Returns: Json;
      };
      can_view_pitocador: {
        Args: { _target_id: string; _user_id: string };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: { _user_id: string }; Returns: boolean };
      is_diretor: { Args: { _user_id: string }; Returns: boolean };
      is_instrutor: { Args: { _user_id: string }; Returns: boolean };
      is_staff: { Args: { _user_id: string }; Returns: boolean };
      is_supervisao: { Args: { _user_id: string }; Returns: boolean };
    };
    Enums: {
      app_role: "administrador" | "operador" | "usuario";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["administrador", "operador", "usuario"],
    },
  },
} as const;
