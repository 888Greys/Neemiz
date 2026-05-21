import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BadgeCheck,
  BarChart2,
  BarChart3,
  Bell,
  BellOff,
  Bitcoin,
  BrainCircuit,
  Calendar,
  CalendarDays,
  Camera,
  CandlestickChart,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  CircleDot,
  CircleHelp,
  Clock,
  Coins,
  CreditCard,
  Dices,
  Egg,
  ExternalLink,
  EyeOff,
  FileEdit,
  FilePlus2,
  Flame,
  Gamepad,
  Gamepad2,
  QrCode,
  Gavel,
  Gift,
  Globe,
  Handshake,
  Headphones,
  HelpCircle,
  History,
  Home,
  Hourglass,
  Info,
  Landmark,
  Laptop2,
  LayoutGrid,
  List,
  Lock,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageCircle,
  MinusCircle,
  Monitor,
  Phone,
  PlaneTakeoff,
  Plus,
  PlusCircle,
  Receipt,
  RefreshCw,
  Rocket,
  Search,
  SearchCode,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  Store,
  Ticket,
  Timer,
  Trash2,
  TrendingUp,
  Trophy,
  Tv2,
  Undo2,
  User,
  UserCheck,
  Users,
  Wallet,
  X,
  XCircle,
  Zap,
} from "lucide-react";

// ─── Icon name → Lucide component map ────────────────────────────────────────

const iconMap: Record<string, LucideIcon> = {
  // A
  account_balance: Landmark,
  account_balance_wallet: Wallet,
  add: Plus,
  add_business: Store,
  add_circle: PlusCircle,
  analytics: BarChart3,
  arrow_back: ArrowLeft,
  arrow_downward: ArrowDown,
  arrow_forward: ArrowRight,
  arrow_outward: ArrowUpRight,
  arrow_upward: ArrowUp,

  // B
  badge: BadgeCheck,
  bar_chart: BarChart2,
  bolt: Zap,

  // C
  calendar_month: Calendar,
  calendar_today: CalendarDays,
  campaign: Megaphone,
  cancel: XCircle,
  candlestick_chart: CandlestickChart,
  casino: Dices,
  chat: MessageCircle,
  chat_bubble_outline: MessageCircle,
  check: Check,
  check_circle: CheckCircle,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  close: X,
  confirmation_number: Ticket,
  currency_bitcoin: Bitcoin,
  currency_exchange: ArrowLeftRight,

  // D
  delete_outline: Trash2,
  desktop_windows: Monitor,
  devices: Laptop2,

  // E
  edit_note: FileEdit,
  egg: Egg,
  emoji_events: Trophy,
  error: AlertCircle,
  expand_less: ChevronUp,
  expand_more: ChevronDown,

  // F
  flight_takeoff: PlaneTakeoff,

  // G
  gavel: Gavel,
  grid_view: LayoutGrid,
  groups: Users,

  // H
  handshake: Handshake,
  help: HelpCircle,
  history: History,
  home: Home,
  hourglass_top: Hourglass,

  // I
  info: Info,

  // K
  keyboard_double_arrow_left: ChevronsLeft,
  keyboard_double_arrow_right: ChevronsRight,

  // L
  language: Globe,
  list_alt: List,
  live_tv: Tv2,
  local_fire_department: Flame,
  lock: Lock,
  logout: LogOut,

  // M
  mail: Mail,
  manage_search: SearchCode,
  menu: Menu,

  // N
  notifications: Bell,
  notifications_off: BellOff,

  // O
  online_prediction: BrainCircuit,
  open_in_new: ExternalLink,

  // P
  payments: CreditCard,
  qr_code: QrCode,
  pending: Clock,
  person: User,
  phone: Phone,
  phone_iphone: Smartphone,
  photo_camera: Camera,
  post_add: FilePlus2,
  price_change: TrendingUp,

  // R
  receipt_long: Receipt,
  redeem: Gift,
  refresh: RefreshCw,
  remove_circle: MinusCircle,
  rocket_launch: Rocket,

  // S
  search: Search,
  security: ShieldCheck,
  send: Send,
  sensors: Activity,
  settings: Settings,
  shield: Shield,
  south_america: Coins,
  sports_esports: Gamepad2,
  sports_soccer: CircleDot,
  storefront: Store,
  support_agent: Headphones,
  swap_horiz: ArrowLeftRight,
  sync_alt: RefreshCw,

  // T
  task_alt: CheckCircle2,
  telegram: Send,
  timer: Timer,
  trending_up: TrendingUp,

  // U
  undo: Undo2,

  // V
  verified: BadgeCheck,
  verified_user: UserCheck,
  videogame_asset: Gamepad,
  visibility_off: EyeOff,

  // W
  warning: AlertTriangle,
};

// ─── Icon component ───────────────────────────────────────────────────────────

type IconProps = {
  name: string;
  className?: string;
  /** When true, uses a slightly heavier stroke to simulate a "filled" look */
  fill?: boolean;
  size?: number;
};

export function Icon({ name, className = "", fill = false, size }: IconProps) {
  const LucideComponent = iconMap[name] ?? CircleHelp;
  return (
    <LucideComponent
      className={className}
      strokeWidth={fill ? 2.5 : 1.75}
      {...(size ? { size } : {})}
    />
  );
}
