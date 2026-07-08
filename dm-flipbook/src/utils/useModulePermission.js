import { useAuth } from '../context/AuthContext';

export function useModulePermission(module) {
  const { hasPermission } = useAuth();
  return {
    canRead:   hasPermission(module, 'read'),
    canWrite:  hasPermission(module, 'write'),
    canDelete: hasPermission(module, 'delete'),
  };
}
