import type { LucideIcon } from 'lucide-react';
import type { AppModule } from '@/src/lib/access-control';
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  FileText,
  HardHat,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Smartphone,
  Timer,
  Truck,
  Users,
} from 'lucide-react';

export type NavItem = {
  module: AppModule;
  href: string;
  label: string;
  icon: LucideIcon;
  section: 'Core' | 'Execution' | 'Business' | 'System';
};

export const navItems: NavItem[] = [
  { module: 'dashboard', href: '/panou', label: 'Panou', icon: LayoutDashboard, section: 'Core' },
  { module: 'projects', href: '/proiecte', label: 'Proiecte', icon: BriefcaseBusiness, section: 'Core' },
  { module: 'work_orders', href: '/lucrari', label: 'Lucrari', icon: ClipboardList, section: 'Execution' },
  { module: 'calendar', href: '/calendar', label: 'Calendar', icon: CalendarDays, section: 'Execution' },
  { module: 'time_tracking', href: '/pontaj', label: 'Pontaj', icon: Timer, section: 'Execution' },
  { module: 'field', href: '/teren', label: 'Teren', icon: Smartphone, section: 'Execution' },
  { module: 'materials', href: '/materiale', label: 'Materiale', icon: Package, section: 'Execution' },
  { module: 'documents', href: '/documente', label: 'Documente', icon: FileText, section: 'Business' },
  { module: 'clients', href: '/clienti', label: 'Clienti', icon: Users, section: 'Business' },
  { module: 'reports', href: '/rapoarte-zilnice', label: 'Rapoarte', icon: HardHat, section: 'Business' },
  { module: 'subcontractors', href: '/subcontractori', label: 'Subcontractori', icon: Truck, section: 'Business' },
  { module: 'financial', href: '/financiar', label: 'Financiar', icon: Receipt, section: 'Business' },
  { module: 'analytics', href: '/analitice', label: 'Analitice', icon: ChartColumn, section: 'System' },
  { module: 'notifications', href: '/notificari', label: 'Notificari', icon: Bell, section: 'System' },
  { module: 'settings', href: '/setari', label: 'Setari', icon: Settings, section: 'System' },
];

export const navSections: Array<NavItem['section']> = ['Core', 'Execution', 'Business', 'System'];
