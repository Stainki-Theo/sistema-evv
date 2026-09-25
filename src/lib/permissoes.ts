import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useDiretoriaAssignments } from "@/lib/data";
import { CARGO_SUPERVISAO, DIRETORIA_TIPOS } from "@/lib/evv";

/**
 * Permissões operacionais do EVV.
 *
 * - Visualização: todos os integrantes autenticados;
 * - Edição de dados operacionais (calendário, eventos): ADMIN, Presidente,
 *   Supervisão e Diretores;
 * - Supervisão vê tudo (inclusive áreas privadas das Diretorias) mas não tem
 *   poderes administrativos técnicos (usuários, configurações do sistema).
 */
export function usePermissoes() {
  const { profile, isAdmin, role } = useAuth();
  const { data: assignments } = useDiretoriaAssignments();

  return useMemo(() => {
    const cargo = (profile?.cargo ?? "").trim();
    const isPresidente = cargo === "Presidente";
    const isSupervisorRole = role === "operador";
    const isSupervisao = cargo === CARGO_SUPERVISAO || isPresidente || isSupervisorRole;
    const isDiretor = (assignments ?? []).some(
      (a) => a.profile_id === profile?.id && a.tipo === DIRETORIA_TIPOS.DIRETOR,
    );
    return {
      isAdmin,
      isPresidente,
      isSupervisao,
      isSupervisorRole,
      isDiretor,
      /** Pode editar dados operacionais compartilhados. */
      canManageOps: isAdmin || isSupervisao || isDiretor,
      /** Área exclusiva dos oficiais cadastrados com nível SUPERVISOR. */
      canSupervisaoGroup: isSupervisorRole,
      /** Vê áreas privadas de qualquer diretoria. */
      canViewAllDiretorias: isAdmin || isSupervisao,
    };
  }, [profile?.cargo, profile?.id, assignments, isAdmin, role]);
}
