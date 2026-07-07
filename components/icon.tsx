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
  Briefcase,
  Keyboard,
  Star,
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
  Compass,
  Crosshair,
  CreditCard,
  Dices,
  Egg,
  ExternalLink,
  EyeOff,
  FileEdit,
  FilePlus2,
  Flame,
  FlaskConical,
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
  Maximize2,
  Minimize2,
  Megaphone,
  Menu,
  MessageCircle,
  Minus,
  MinusCircle,
  Monitor,
  LineChart,
  PenTool,
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
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  TrendingDown,
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
  Ban,
  Copy,
  Lightbulb,
  Share2,
  UserPlus,
  KeyRound,
  AtSign,
  CheckCheck,
  Download,
  Award,
  EllipsisVertical,
  Percent,
  MessageSquareText,
  ListChecks,
  Bot,
  Image as ImageIcon,
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
  block: Ban,
  bolt: Zap,
  briefcase: Briefcase,
  work: Briefcase,

  // C
  calendar_month: Calendar,
  calendar_today: CalendarDays,
  campaign: Megaphone,
  cancel: XCircle,
  candlestick_chart: CandlestickChart,
  casino: Dices,
  chat: MessageCircle,
  chat_bubble: MessageCircle,
  chat_bubble_outline: MessageCircle,
  check: Check,
  content_copy: Copy,
  check_circle: CheckCircle,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  close: X,
  confirmation_number: Ticket,
  currency_bitcoin: Bitcoin,
  currency_exchange: ArrowLeftRight,

  // D
  dashboard: LayoutGrid,
  delete: Trash2,
  delete_outline: Trash2,
  desktop_windows: Monitor,
  devices: Laptop2,
  draw: PenTool,

  // E
  edit: FileEdit,
  edit_note: FileEdit,
  egg: Egg,
  emoji_events: Trophy,
  error: AlertCircle,
  explore: Compass,
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
  keyboard: Keyboard,
  keyboard_arrow_down: ChevronDown,
  keyboard_arrow_up: ChevronUp,
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
  fullscreen: Maximize2,
  fullscreen_exit: Minimize2,
  menu: Menu,
  my_location: Crosshair,

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
  person_add: UserPlus,
  phone: Phone,
  phone_iphone: Smartphone,
  photo_camera: Camera,
  post_add: FilePlus2,
  price_change: TrendingUp,

  // R
  receipt_long: Receipt,
  redeem: Gift,
  refresh: RefreshCw,
  remove: Minus,
  remove_circle: MinusCircle,
  show_chart: LineChart,
  rocket_launch: Rocket,

  // S
  schedule: Clock,
  search: Search,
  security: ShieldCheck,
  send: Send,
  share: Share2,
  sensors: Activity,
  settings: Settings,
  shield: Shield,
  south_america: Coins,
  star: Star,
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
  tips_and_updates: Lightbulb,
  thumb_down: ThumbsDown,
  thumb_up: ThumbsUp,
  trending_down: TrendingDown,
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

  // Previously-missing names (rendered a "?" fallback before)
  credit_card: CreditCard,
  science: FlaskConical,
  passkey: KeyRound,
  alternate_email: AtSign,
  arrow_drop_down: ChevronDown,
  approval: CheckCheck,
  apps: LayoutGrid,
  download: Download,
  image: ImageIcon,
  loyalty: Award,
  more_vert: EllipsisVertical,
  percent: Percent,
  policy: ShieldCheck,
  rate_review: MessageSquareText,
  rule: ListChecks,
  smart_toy: Bot,
  groups_2: Users,
  stacked_bar_chart: BarChart3,
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
