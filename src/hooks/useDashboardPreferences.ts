import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useUserRole";

export type WidgetId =
  | "announcements"
  | "specialties"
  | "bookmarks"
  | "recent_resources"
  | "watched_discussions"
  | "contacts";

const DEFAULT_LAYOUT: WidgetId[] = [
  "announcements",
  "specialties",
  "bookmarks",
  "recent_resources",
  "watched_discussions",
  "contacts",
];

export function useDashboardPreferences() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["dashboard-preferences", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("dashboard_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const layout: WidgetId[] = (prefs?.widget_layout as WidgetId[] | null) ?? DEFAULT_LAYOUT;
  const hiddenWidgets: WidgetId[] = (prefs?.hidden_widgets as WidgetId[] | null) ?? [];
  const columns: 1 | 2 = ((prefs as any)?.columns === 2 ? 2 : 1);
  const rightColumnWidgets: WidgetId[] = ((prefs as any)?.right_column_widgets as WidgetId[] | null) ?? [];

  const savePrefs = useMutation({
    mutationFn: async (update: {
      widget_layout?: WidgetId[];
      hidden_widgets?: WidgetId[];
      columns?: 1 | 2;
      right_column_widgets?: WidgetId[];
    }) => {
      if (!user) return;
      const payload = {
        user_id: user.id,
        widget_layout: update.widget_layout ?? layout,
        hidden_widgets: update.hidden_widgets ?? hiddenWidgets,
        columns: update.columns ?? columns,
        right_column_widgets: update.right_column_widgets ?? rightColumnWidgets,
      };
      const { error } = await supabase
        .from("dashboard_preferences")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard-preferences"] }),
  });

  return { layout, hiddenWidgets, columns, rightColumnWidgets, isLoading, savePrefs };
}
