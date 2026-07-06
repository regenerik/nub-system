export type UserRole = "admin" | "recepcion" | "barbero" | "cliente";

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show"
  | "rescheduled"
  | "pending_reschedule";

export type PaymentMethod =
  | "efectivo"
  | "transferencia"
  | "tarjeta_debito"
  | "tarjeta_credito"
  | "mercado_pago"
  | "otro";

export type SaleStatus =
  | "pending"
  | "paid"
  | "partially_paid"
  | "cancelled"
  | "refunded";

export type ServiceType = "main" | "extra" | "both";
export type SaleItemType = "service" | "product";

export type Branch = {
  id: number;
  name: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
  opening_hours?: string | null;
  image_url?: string | null;
  is_active: boolean;
  barber_count?: number;
  appointment_count?: number;
};

export type BranchDateClosure = {
  id: number;
  branch_id: number;
  date: string;
  reason?: string | null;
  is_active: boolean;
  created_by_user_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type ScheduleBlock = {
  id: number;
  branch_id: number;
  barber_id?: number | null;
  starts_at: string;
  ends_at: string;
  reason?: string | null;
  created_by_user_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type BarberAvailability = {
  id: number;
  barber_id: number;
  branch_id: number;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export type User = {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  branch_id?: number | null;
  is_active: boolean;
  can_apply_discounts: boolean;
  google_account_id?: string | null;
  profile_image_url?: string | null;
};

export type Client = {
  id: number;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  phone: string;
  dni?: string | null;
  birth_date?: string | null;
  notes?: string | null;
  profile_image_url?: string | null;
  is_active: boolean;
};

export type Barber = {
  id: number;
  user_id?: number | null;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  bio?: string | null;
  profile_image_url?: string | null;
  commission_percentage?: number | null;
  fixed_salary?: number | null;
  is_active: boolean;
  branch_ids?: number[];
};

export type Service = {
  id: number;
  name: string;
  description?: string | null;
  duration_minutes: number;
  price: number;
  cost_estimate?: number | null;
  image_url?: string | null;
  service_type: ServiceType;
  is_active: boolean;
  branch_ids?: number[];
};

export type Product = {
  id: number;
  name: string;
  description?: string | null;
  sku?: string | null;
  sale_price: number;
  unit_cost: number;
  image_url?: string | null;
  is_active: boolean;
  stock?: BranchProductStock;
};

export type BranchProductStock = {
  id: number;
  branch_id: number;
  product_id: number;
  current_stock: number;
  min_stock: number;
  updated_at?: string | null;
};

export type Appointment = {
  id: number;
  branch_id: number;
  client_id: number;
  barber_id: number;
  primary_service_id: number;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: string;
  customer_comment?: string | null;
  internal_notes?: string | null;
  cancellation_reason?: string | null;
  total_estimated: number;
  total_final?: number | null;
  client?: Client;
  barber?: Barber;
  primary_service?: Service;
  extra_services?: Array<AppointmentExtraService & { name?: string; price?: number; duration_minutes?: number; service?: Service }>;
  sale?: Sale | null;
  payment_status?: SaleStatus | "unpaid";
  paid_total?: number;
  payment_pending?: number;
  tip_amount?: number;
  branch?: Branch;
};

export type AppointmentExtraService = {
  id: number;
  appointment_id: number;
  service_id: number;
  price_at_booking: number;
  duration_minutes_at_booking: number;
};

export type Sale = {
  id: number;
  branch_id: number;
  client_id?: number | null;
  appointment_id?: number | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  status: SaleStatus;
  created_at?: string;
};

export type SaleItem = {
  id: number;
  sale_id: number;
  item_type: SaleItemType;
  service_id?: number | null;
  product_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost?: number | null;
  total_price: number;
  total_cost?: number | null;
};

export type Payment = {
  id: number;
  sale_id: number;
  method: PaymentMethod;
  amount: number;
  paid_at: string;
  reference?: string | null;
};

export type Expense = {
  id: number;
  branch_id?: number | null;
  category: string;
  description?: string | null;
  amount: number;
  expense_date: string;
};

export type SalaryPayment = {
  id: number;
  branch_id?: number | null;
  recipient_type?: "barbero" | "recepcion";
  barber_id?: number | null;
  user_id?: number | null;
  amount: number;
  period_start: string;
  period_end: string;
  paid_at?: string | null;
  notes?: string | null;
};

export type DashboardStats = {
  revenue_total: number;
  discount_total: number;
  sales_count: number;
  appointments_total: number;
  appointments_completed: number;
  appointments_cancelled: number;
  no_show_count: number;
  clients_total: number;
  new_clients: number;
  average_ticket: number;
  gross_profit: number;
  net_profit: number;
  total_expenses: number;
  total_salaries: number;
  product_cost_total: number;
  stock_value_total: number;
};

export type ChartDatum = {
  [key: string]: string | number | null;
};

export type RoleSummary = {
  name: string;
  scope: string;
};

export type ApiList<T> = {
  items: T[];
};

export type LoginResponse = {
  access_token: string;
  user: User;
};
