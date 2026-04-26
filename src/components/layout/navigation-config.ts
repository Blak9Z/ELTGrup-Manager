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
  History,
  LayoutDashboard,
  Package,
  Receipt,
  ScrollTextIcon,
  Settings,
  Smartphone,
  Timer,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';

export type NavItem = {
  module: AppModule;
  href: string;
  label: string;
  icon: LucideIcon;
  section: "Baza" | "Executie" | "Comercial" | "Sistem";
};

export const navItems: NavItem[] = [
  { module: "dashboard", href: "/panou", label: "Panou", icon: LayoutDashboard, section: "Baza" },
  { module: "projects", href: "/oferte", label: "Oferte", icon: ScrollTextIcon, section: "Baza" },
  { module: "projects", href: "/proiecte", label: "Proiecte", icon: BriefcaseBusiness, section: "Baza" },
  { module: "work_orders", href: "/lucrari", label: "Lucrari", icon: ClipboardList, section: "Executie" },
  { module: "teams", href: "/echipe", label: "Echipe", icon: Users, section: "Executie" },
  { module: "calendar", href: "/calendar", label: "Calendar", icon: CalendarDays, section: "Executie" },
  { module: "time_tracking", href: "/pontaj", label: "Pontaj", icon: Timer, section: "Executie" },
  { module: "field", href: "/teren", label: "Teren", icon: Smartphone, section: "Executie" },
  { module: "materials", href: "/materiale", label: "Materiale", icon: Package, section: "Executie" },
  { module: "materials", href: "/gestiune-scule", label: "Gestiune scule", icon: Wrench, section: "Executie" },
  { module: "documents", href: "/documente", label: "Documente", icon: FileText, section: "Comercial" },
  { module: "clients", href: "/clienti", label: "Clienti", icon: Users, section: "Comercial" },
  { module: "reports", href: "/rapoarte-zilnice", label: "Rapoarte", icon: HardHat, section: "Comercial" },
  { module: "subcontractors", href: "/subcontractori", label: "Subcontractori", icon: Truck, section: "Comercial" },
  { module: "financial", href: "/financiar", label: "Financiar", icon: Receipt, section: "Comercial" },
  { module: "analytics", href: "/analitice", label: "Analitice", icon: ChartColumn, section: "Sistem" },
  { module: "notifications", href: "/notificari", label: "Notificari", icon: Bell, section: "Sistem" },
  { module: "settings", href: "/setari/activitate", label: "Activitate", icon: History, section: "Sistem" },
  { module: "settings", href: "/setari", label: "Setari", icon: Settings, section: "Sistem" },
];

export const navSections: Array<NavItem["section"]> = ["Baza", "Executie", "Comercial", "Sistem"];
