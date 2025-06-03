import SupabaseService from '../services/supabase';
import OptimalMultiRailService from '../services/optimal-multi-rail';
import ComplianceService from '../services/compliance';
import MonitoringService from '../services/monitoring';

declare global {
  namespace Express {
    interface Request {
      services: {
        supabase: SupabaseService;
        multiRail: OptimalMultiRailService;
        compliance: ComplianceService;
        monitoring: MonitoringService;
      };
    }
  }
} 