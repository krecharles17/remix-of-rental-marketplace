import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // CRITICAL: Wait for auth to finish loading first
    if (authLoading) {
      return; // Don't do anything while auth is loading
    }

    // Auth has finished loading
    if (!user) {
      // No user found after auth finished - set empty roles
      setRoles([]);
      setLoading(false);
      return;
    }

    // User exists - fetch their roles
    const fetchRoles = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!error && data) {
        setRoles(data.map((r) => r.role));
      }
      setLoading(false);
    };

    fetchRoles();
  }, [user, authLoading]);

  const hasRole = (role: string) => roles.includes(role);
  const isHost = hasRole("host") || hasRole("admin");
  const isAdmin = hasRole("admin");
  const isGuest = hasRole("guest");

  const requestHostRole = async () => {
    if (!user) return { error: "Not authenticated" };
    if (roles.length > 0) return { error: null };

    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: "host" });

    if (!error) {
      setRoles([...roles, "host"]);
    }

    return { error };
  };

  return { roles, loading, hasRole, isHost, isAdmin, isGuest, requestHostRole };
};
