export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          goal: string;
          level: string;
          focus: string;
          equipment: string;
          duration: number;
          workout_days: number[];
          onboarding_complete: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string;
          full_name?: string;
          goal?: string;
          level?: string;
          focus?: string;
          equipment?: string;
          duration?: number;
          workout_days?: number[];
          onboarding_complete?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          goal?: string;
          level?: string;
          focus?: string;
          equipment?: string;
          duration?: number;
          workout_days?: number[];
          onboarding_complete?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      workout_plans: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          goal: string;
          level: string;
          focus: string;
          equipment: string;
          duration: number;
          plan_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          goal?: string;
          level?: string;
          focus?: string;
          equipment?: string;
          duration?: number;
          plan_data?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          goal?: string;
          level?: string;
          focus?: string;
          equipment?: string;
          duration?: number;
          plan_data?: Json;
          created_at?: string;
        };
      };
      scheduled_workouts: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          scheduled_date: string;
          day_of_week: number;
          title: string;
          focus: string;
          status: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          scheduled_date: string;
          day_of_week?: number;
          title?: string;
          focus?: string;
          status?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string;
          scheduled_date?: string;
          day_of_week?: number;
          title?: string;
          focus?: string;
          status?: string;
          completed_at?: string | null;
          created_at?: string;
        };
      };
      workout_logs: {
        Row: {
          id: string;
          user_id: string;
          scheduled_workout_id: string | null;
          plan_id: string | null;
          started_at: string;
          finished_at: string | null;
          exercises_completed: number;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          scheduled_workout_id?: string | null;
          plan_id?: string | null;
          started_at?: string;
          finished_at?: string | null;
          exercises_completed?: number;
          notes?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          scheduled_workout_id?: string | null;
          plan_id?: string | null;
          started_at?: string;
          finished_at?: string | null;
          exercises_completed?: number;
          notes?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
