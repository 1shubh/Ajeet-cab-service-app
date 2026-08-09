import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
  Linking,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import React, { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppDispatch, RootState } from "@/redux/store";
import {
  fetchDriverById,
  fetchDriverPayments,
  fetchVehicles,
  recordPayment,
  deletePayment,
  assignVehicle,
  assignRoute,
  setDriverStatus,
  clearCurrentDriver,
  clearDriverSubmitState,
  PaymentType,
  PaymentMethod,
  DriverStatus,
} from "@/redux/slice/driverSlice";
import { fetchRoutes } from "@/redux/slice/routeslice";
import { useAlert, AlertButton } from "@/components/AlertProvider";

// ============================================================
// Date helpers
//
// These deliberately avoid toISOString(). In IST (UTC+5:30),
// `new Date(2026, 7, 1).toISOString()` yields '2026-07-31T18:30Z',
// so slicing it gives the PREVIOUS month. Same bug shifts the
// default paid-on date backwards on the 1st of any month.
// Everything below is built from local date parts instead.
// ============================================================
const pad = (n: number) => String(n).padStart(2, "0");

/** 'YYYY-MM' for right now, in local time */
export const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

/** 'YYYY-MM-DD' for today, in local time */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Current month first, then the 11 before it */
const recentPeriods = () => {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }
  return out;
};

const formatMonth = (period: string) => {
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
};

const formatMonthShort = (period: string) => {
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const money = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

// ============================================================
const PAYMENT_TYPES: { key: PaymentType; label: string; hint: string }[] = [
  { key: "advance", label: "Advance", hint: "Paid before month end — reduces what's still owed" },
  { key: "salary", label: "Salary", hint: "A regular salary payment" },
  { key: "bonus", label: "Bonus", hint: "Increases what's owed for this month" },
  { key: "deduction", label: "Deduction", hint: "Reduces what's owed — damages, unpaid leave" },
];

const METHODS: PaymentMethod[] = ["cash", "upi", "bank", "cheque"];

const TYPE_COLOR: Record<PaymentType, string> = {
  advance: "text-yellow-400",
  salary: "text-green-400",
  bonus: "text-blue-400",
  deduction: "text-red-400",
};

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <View className="flex-row justify-between py-3 border-b border-gray-800">
    <Text className="text-gray-500 text-xs">{label}</Text>
    <Text
      className="text-white text-xs font-pmedium flex-1 text-right ml-4"
      numberOfLines={2}
    >
      {value || "—"}
    </Text>
  </View>
);

// ============================================================
export default function DriverDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { alert, confirm, toast } = useAlert();

  const {
    current: driver,
    currentLoading,
    payments,
    periods,
    paymentsLoading,
    vehicles,
    submitting,
    submitError,
  } = useSelector((s: RootState) => s.drivers);
  const { routes } = useSelector((s: RootState) => s.routes);
  const { profile } = useSelector((s: RootState) => s.profile);

  const [tab, setTab] = useState<"details" | "salary">("details");
  const [payModal, setPayModal] = useState(false);

  const [payForm, setPayForm] = useState({
    amount: "",
    type: "advance" as PaymentType,
    period: currentPeriod(),
    paid_on: todayISO(),
    method: "cash" as PaymentMethod,
    note: "",
  });

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    dispatch(fetchDriverById(id));
    dispatch(fetchDriverPayments({ driverId: id }));
    dispatch(fetchVehicles());
    dispatch(fetchRoutes());
    return () => {
      dispatch(clearCurrentDriver());
    };
  }, [id]);

  useEffect(() => {
    if (submitError) {
      alert("Couldn't complete that", submitError, undefined, {
        tone: "danger",
      });
      dispatch(clearDriverSubmitState());
    }
  }, [submitError]);

  // ----------------------------------------------------------
  const openPayModal = () => {
    // Reset to today's date and this month every time it opens,
    // so a stale period from a previous entry can't leak through
    setPayForm({
      amount: "",
      type: "advance",
      period: currentPeriod(),
      paid_on: todayISO(),
      method: "cash",
      note: "",
    });
    setPayModal(true);
  };

  const handleRecordPayment = async () => {
    const amount = Number(payForm.amount);
    if (!amount || amount <= 0) {
      toast("Enter an amount", "warning");
      return;
    }

    const result = await dispatch(
      recordPayment({
        driver_id: id,
        amount,
        type: payForm.type,
        period: payForm.period,
        paid_on: payForm.paid_on,
        method: payForm.method,
        note: payForm.note,
      })
    );

    if (recordPayment.fulfilled.match(result)) {
      setPayModal(false);
      dispatch(fetchDriverById(id));
      dispatch(fetchDriverPayments({ driverId: id }));
      toast(`${money(amount)} recorded`);
    }
  };

  const handleDeletePayment = async (paymentId: string, amount: number) => {
    const ok = await confirm({
      title: "Delete this entry?",
      message: `${money(amount)} will be removed from the ledger and the balance recalculated.`,
      confirmText: "Delete",
      tone: "danger",
    });

    if (!ok) return;

    const result = await dispatch(deletePayment(paymentId));
    if (deletePayment.fulfilled.match(result)) {
      dispatch(fetchDriverById(id));
      dispatch(fetchDriverPayments({ driverId: id }));
      toast("Entry deleted");
    }
  };

  const pickVehicle = () => {
    const free = vehicles.filter(
      (v) => !v.assigned_driver_id || v.assigned_driver_id === driver?.driver_id
    );

    if (free.length === 0 && !driver?.vehicle_id) {
      alert(
        "No vehicles available",
        vehicles.length === 0
          ? "No vehicles have been added yet."
          : "Every vehicle is already assigned to another driver.",
        undefined,
        { tone: "warning" }
      );
      return;
    }

    const options: AlertButton[] = free
      .filter((v) => v.id !== driver?.vehicle_id)
      .map((v) => ({
        text: v.bus_number,
        onPress: async () => {
          const r = await dispatch(
            assignVehicle({ driverId: id, vehicleId: v.id })
          );
          if (assignVehicle.fulfilled.match(r)) {
            toast(`${v.bus_number} assigned`);
          }
        },
      }));

    if (driver?.vehicle_id) {
      options.push({
        text: "Unassign vehicle",
        style: "destructive",
        onPress: async () => {
          await dispatch(assignVehicle({ driverId: id, vehicleId: null }));
          toast("Vehicle unassigned");
        },
      });
    }

    options.push({ text: "Cancel", style: "cancel" });
    alert("Assign vehicle", "Pick a bus for this driver", options);
  };

  const pickRoute = () => {
    if ((routes?.length ?? 0) === 0) {
      alert(
        "No routes yet",
        "Create a route before assigning one.",
        undefined,
        { tone: "warning" }
      );
      return;
    }

    const options: AlertButton[] = (routes ?? [])
      .filter((r) => r.id !== driver?.route_id)
      .map((r) => ({
        text: r.name,
        onPress: async () => {
          const res = await dispatch(
            assignRoute({ driverId: id, routeId: r.id })
          );
          if (assignRoute.fulfilled.match(res)) toast(`${r.name} assigned`);
        },
      }));

    if (driver?.route_id) {
      options.push({
        text: "Unassign route",
        style: "destructive",
        onPress: async () => {
          await dispatch(assignRoute({ driverId: id, routeId: null }));
          toast("Route unassigned");
        },
      });
    }

    options.push({ text: "Cancel", style: "cancel" });
    alert("Assign route", "Pick a route for this driver", options);
  };

  const changeStatus = () => {
    const options: AlertButton[] = (
      ["active", "on_leave", "inactive"] as DriverStatus[]
    )
      .filter((s) => s !== driver?.status)
      .map((s) => ({
        text:
          s === "active"
            ? "Mark active"
            : s === "on_leave"
              ? "Mark on leave"
              : "Deactivate",
        style: s === "inactive" ? ("destructive" as const) : undefined,
        onPress: async () => {
          if (s === "inactive") {
            const ok = await confirm({
              title: "Deactivate driver?",
              message:
                "Their vehicle and route will be freed up. Salary history is kept.",
              confirmText: "Deactivate",
              tone: "danger",
            });
            if (!ok) return;
          }

          const r = await dispatch(setDriverStatus({ driverId: id, status: s }));
          if (setDriverStatus.fulfilled.match(r)) {
            dispatch(fetchDriverById(id));
            toast("Status updated");
          }
        },
      }));

    options.push({ text: "Cancel", style: "cancel" });
    alert(
      "Change status",
      `${driver?.name} is currently ${driver?.status === "on_leave" ? "on leave" : driver?.status}`,
      options
    );
  };

  // ----------------------------------------------------------
  if (currentLoading || !driver) {
    return (
      <View className="flex-1 bg-appBg items-center justify-center">
        <ActivityIndicator color="#FACC15" size="large" />
      </View>
    );
  }

  const initials = driver.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const owes = driver.balance_due > 0;
  const isCurrentPeriod = payForm.period === currentPeriod();

  // Live preview of the balance after this entry
  const amountNum = Number(payForm.amount) || 0;
  const projectedBalance =
    payForm.type === "bonus"
      ? driver.balance_due + amountNum
      : payForm.type === "deduction"
        ? driver.balance_due - amountNum
        : driver.balance_due - amountNum;

  return (
    <>
      <ScrollView
        className="flex-1 bg-appBg"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center gap-3 mb-5">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full border border-[#665524] items-center justify-center"
          >
            <Ionicons name="arrow-back" size={16} color="#FACC15" />
          </TouchableOpacity>
          <View className="flex-1" />
          <TouchableOpacity
            onPress={isAdmin ? changeStatus : undefined}
            disabled={!isAdmin}
            className={`px-3 py-1.5 rounded-full ${
              driver.status === "active"
                ? "bg-green-950"
                : driver.status === "on_leave"
                  ? "bg-yellow-950"
                  : "bg-gray-800"
            }`}
          >
            <Text
              className={`text-xs font-pmedium ${
                driver.status === "active"
                  ? "text-green-300"
                  : driver.status === "on_leave"
                    ? "text-yellow-300"
                    : "text-gray-400"
              }`}
            >
              {driver.status === "on_leave" ? "On leave" : driver.status}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Identity */}
        <View className="items-center mb-5">
          <View className="w-24 h-24 rounded-full border-2 border-yellow-400 overflow-hidden items-center justify-center bg-darkinputbg mb-3">
            {driver.profile_image ? (
              <Image
                source={{ uri: driver.profile_image }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <Text className="text-yellow-400 font-psemibold text-2xl">
                {initials}
              </Text>
            )}
          </View>
          <Text className="text-white font-psemibold text-lg">
            {driver.name}
          </Text>
          <Text className="text-gray-500 text-xs mt-0.5">
            Joined {formatDate(driver.joined_at)}
          </Text>
        </View>

        {driver.phone && (
          <TouchableOpacity
            onPress={() => Linking.openURL(`tel:+91${driver.phone}`)}
            className="bg-yellow-500 h-12 rounded-xl items-center justify-center mb-5 flex-row gap-2"
          >
            <Ionicons name="call" size={16} color="#000" />
            <Text className="text-black font-psemibold text-sm">
              Call +91 {driver.phone}
            </Text>
          </TouchableOpacity>
        )}

        {/* Tabs */}
        <View className="flex-row gap-2 mb-4">
          {(["details", "salary"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              className={`flex-1 h-11 rounded-xl items-center justify-center border ${
                tab === t
                  ? "border-yellow-400 bg-[#2a2412]"
                  : "border-gray-700 bg-darkinputbg"
              }`}
            >
              <Text
                className={`text-xs font-pmedium ${
                  tab === t ? "text-yellow-400" : "text-gray-400"
                }`}
              >
                {t === "details" ? "Details" : "Salary"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ---------------- DETAILS TAB ---------------- */}
        {tab === "details" && (
          <>
            <Text className="text-gray-500 text-xs uppercase tracking-widest mb-2">
              Assignment
            </Text>

            <TouchableOpacity
              onPress={isAdmin ? pickVehicle : undefined}
              disabled={!isAdmin}
              className="border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-2 flex-row items-center gap-3"
            >
              <View className="w-9 h-9 rounded-lg bg-[#2a2412] items-center justify-center">
                <Ionicons name="bus" size={18} color="#FACC15" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-500 text-xs">Vehicle</Text>
                <Text className="text-white font-pmedium text-sm">
                  {driver.bus_number ?? "Not assigned"}
                </Text>
              </View>
              {isAdmin && (
                <Ionicons name="chevron-forward" size={16} color="#6b7280" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={isAdmin ? pickRoute : undefined}
              disabled={!isAdmin}
              className="border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-4 flex-row items-center gap-3"
            >
              <View className="w-9 h-9 rounded-lg bg-[#2a2412] items-center justify-center">
                <Ionicons name="git-branch" size={18} color="#FACC15" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-500 text-xs">Route</Text>
                <Text className="text-white font-pmedium text-sm">
                  {driver.route_name ?? "Not assigned"}
                </Text>
                {driver.route_name && (
                  <Text className="text-gray-600 text-xs mt-0.5">
                    {driver.students_on_route} student
                    {driver.students_on_route === 1 ? "" : "s"} on this route
                  </Text>
                )}
              </View>
              {isAdmin && (
                <Ionicons name="chevron-forward" size={16} color="#6b7280" />
              )}
            </TouchableOpacity>

            <Text className="text-gray-500 text-xs uppercase tracking-widest mb-2">
              Documents
            </Text>
            <View className="border border-gray-700 bg-darkinputbg rounded-xl px-4 mb-4">
              <Row label="License number" value={driver.license_number} />
              <Row
                label="License expiry"
                value={
                  driver.license_expiry
                    ? formatDate(driver.license_expiry)
                    : null
                }
              />
            </View>

            {driver.license_expiry &&
              new Date(driver.license_expiry) <
                new Date(Date.now() + 30 * 86400000) && (
                <View className="border border-red-900 bg-red-950 rounded-xl p-3 mb-4">
                  <Text className="text-red-300 text-xs font-pmedium">
                    {new Date(driver.license_expiry) < new Date()
                      ? "License has expired"
                      : `License expires ${formatDate(driver.license_expiry)}`}
                  </Text>
                </View>
              )}

            <Text className="text-gray-500 text-xs uppercase tracking-widest mb-2">
              Activity
            </Text>
            <View className="border border-gray-700 bg-darkinputbg rounded-xl px-4 mb-4">
              <Row
                label="Students admitted"
                value={String(driver.total_admissions)}
              />
              <Row
                label="Monthly salary"
                value={money(driver.monthly_salary)}
              />
            </View>

            {isAdmin && (
              <TouchableOpacity
                onPress={() => router.push(`/driver/edit/${id}`)}
                className="border border-yellow-400 h-12 rounded-xl items-center justify-center"
              >
                <Text className="text-yellow-400 font-pmedium text-sm">
                  Edit driver details
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ---------------- SALARY TAB ---------------- */}
        {tab === "salary" && (
          <>
            <View
              className={`border rounded-xl p-4 mb-4 ${
                owes
                  ? "border-yellow-300 bg-darkinputbg"
                  : "border-green-900 bg-green-950"
              }`}
            >
              <Text className="text-gray-400 text-xs mb-1">
                {formatMonth(currentPeriod())}
              </Text>
              <View className="flex-row justify-between items-end">
                <View>
                  <Text className="text-gray-500 text-xs mb-0.5">
                    Balance due
                  </Text>
                  <Text
                    className={`text-2xl font-psemibold ${
                      owes ? "text-yellow-400" : "text-green-400"
                    }`}
                  >
                    {money(driver.balance_due)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-gray-500 text-xs mb-0.5">
                    Paid so far
                  </Text>
                  <Text className="text-white text-base font-pmedium">
                    {money(driver.paid_this_month)}
                  </Text>
                </View>
              </View>

              <View className="bg-gray-800 rounded-full h-2 mt-3">
                <View
                  className="bg-green-400 rounded-full h-2"
                  style={{
                    width: `${
                      driver.monthly_salary > 0
                        ? Math.min(
                            100,
                            Math.round(
                              (driver.paid_this_month / driver.monthly_salary) *
                                100
                            )
                          )
                        : 0
                    }%`,
                  }}
                />
              </View>
              <Text className="text-gray-600 text-xs mt-2">
                Salary {money(driver.monthly_salary)} per month
              </Text>
            </View>

            {isAdmin && (
              <TouchableOpacity
                onPress={openPayModal}
                className="bg-yellow-500 h-12 rounded-xl items-center justify-center mb-5 flex-row gap-2"
              >
                <Ionicons name="add" size={18} color="#000" />
                <Text className="text-black font-psemibold text-sm">
                  Record payment
                </Text>
              </TouchableOpacity>
            )}

            {periods.length > 1 && (
              <>
                <Text className="text-gray-500 text-xs uppercase tracking-widest mb-2">
                  By month
                </Text>
                {periods.slice(0, 6).map((p) => (
                  <View
                    key={p.period}
                    className="border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-2"
                  >
                    <View className="flex-row justify-between items-center">
                      <Text className="text-white font-pmedium text-xs">
                        {formatMonth(p.period)}
                      </Text>
                      <Text
                        className={`text-xs font-psemibold ${
                          Number(p.balance_due) > 0
                            ? "text-red-400"
                            : "text-green-400"
                        }`}
                      >
                        {Number(p.balance_due) > 0
                          ? `${money(p.balance_due)} due`
                          : "Settled"}
                      </Text>
                    </View>
                    <View className="flex-row gap-4 mt-2">
                      {Number(p.advances) > 0 && (
                        <Text className="text-gray-500 text-xs">
                          Advance {money(p.advances)}
                        </Text>
                      )}
                      {Number(p.salary_paid) > 0 && (
                        <Text className="text-gray-500 text-xs">
                          Salary {money(p.salary_paid)}
                        </Text>
                      )}
                      {Number(p.deductions) > 0 && (
                        <Text className="text-gray-500 text-xs">
                          Deducted {money(p.deductions)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}

            <Text className="text-gray-500 text-xs uppercase tracking-widest mb-2 mt-3">
              Payment history
            </Text>

            {paymentsLoading && payments.length === 0 && (
              <ActivityIndicator color="#FACC15" className="mt-4" />
            )}

            {!paymentsLoading && payments.length === 0 && (
              <Text className="text-gray-600 text-xs ml-1">
                No payments recorded yet.
              </Text>
            )}

            {payments.map((p) => (
              <View
                key={p.id}
                className="border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-2"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text
                        className={`font-psemibold text-sm ${TYPE_COLOR[p.type]}`}
                      >
                        {p.type === "deduction" ? "−" : "+"}
                        {money(p.amount)}
                      </Text>
                      <View className="bg-gray-800 px-2 py-0.5 rounded-full">
                        <Text className="text-gray-400 text-xs capitalize">
                          {p.type}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-gray-500 text-xs mt-1">
                      {formatDate(p.paid_on)}
                      {p.method ? ` · ${p.method}` : ""} ·{" "}
                      {formatMonth(p.period)}
                    </Text>
                    {p.note ? (
                      <Text className="text-gray-600 text-xs mt-1">
                        {p.note}
                      </Text>
                    ) : null}
                  </View>

                  {isAdmin && (
                    <TouchableOpacity
                      onPress={() => handleDeletePayment(p.id, p.amount)}
                      hitSlop={10}
                      className="w-7 h-7 items-center justify-center"
                    >
                      <Ionicons name="trash-outline" size={15} color="#F87171" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* ---------------- RECORD PAYMENT SHEET ---------------- */}
      <Modal
        visible={payModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setPayModal(false)}
      >
        {/* Layout must live in `style` — NativeWind classes on
            KeyboardAvoidingView don't reliably apply, which is
            what pinned this sheet to the top of the screen */}
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.7)",
          }}
        >
          <TouchableWithoutFeedback onPress={() => setPayModal(false)}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
          >
            <View
              className="bg-[#0F1B24] border-t border-[#665524] rounded-t-3xl px-5 pt-3"
              style={{ paddingBottom: insets.bottom + 20 }}
            >
              <View className="w-10 h-1 bg-gray-700 rounded-full self-center mb-4" />

              <View className="flex-row items-center justify-between mb-4">
                <View>
                  <Text className="text-white font-psemibold text-base">
                    Record payment
                  </Text>
                  <Text className="text-gray-500 text-xs mt-0.5">
                    {driver.name} · {money(driver.balance_due)} due
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setPayModal(false)}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={22} color="#9ca3af" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: Dimensions.get("window").height * 0.5 }}
              >
                {/* Type */}
                <Text className="text-white font-pregular text-sm mb-2 ml-1">
                  Type
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-1">
                  {PAYMENT_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setPayForm((p) => ({ ...p, type: t.key }))}
                      className={`px-4 py-2.5 rounded-xl border-2 ${
                        payForm.type === t.key
                          ? "border-yellow-400 bg-[#2a2412]"
                          : "border-gray-700 bg-darkinputbg"
                      }`}
                    >
                      <Text
                        className={`text-xs font-pmedium ${
                          payForm.type === t.key
                            ? "text-yellow-400"
                            : "text-gray-400"
                        }`}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text className="text-gray-600 text-xs mb-4 ml-1">
                  {PAYMENT_TYPES.find((t) => t.key === payForm.type)?.hint}
                </Text>

                {/* Amount */}
                <Text className="text-white font-pregular text-sm mb-1.5 ml-1">
                  Amount
                </Text>
                <View className="border-2 border-[#665524] rounded-xl flex-row items-center px-3 mb-3">
                  <Text className="text-gray-400 font-pmedium mr-1 text-lg">
                    ₹
                  </Text>
                  <TextInput
                    className="flex-1 text-white font-psemibold text-lg"
                    style={{ height: 52 }}
                    placeholder="1000"
                    placeholderTextColor="#6b6b6b"
                    keyboardType="numeric"
                    value={payForm.amount}
                    onChangeText={(t) =>
                      setPayForm((p) => ({
                        ...p,
                        amount: t.replace(/[^0-9]/g, ""),
                      }))
                    }
                  />
                </View>

                {/* Quick amounts */}
                <View className="flex-row gap-2 mb-4">
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      onPress={() =>
                        setPayForm((p) => ({ ...p, amount: String(amt) }))
                      }
                      className={`flex-1 h-10 rounded-lg border items-center justify-center ${
                        payForm.amount === String(amt)
                          ? "border-yellow-400 bg-[#2a2412]"
                          : "border-gray-700 bg-darkinputbg"
                      }`}
                    >
                      <Text
                        className={`text-xs font-pmedium ${
                          payForm.amount === String(amt)
                            ? "text-yellow-400"
                            : "text-gray-400"
                        }`}
                      >
                        ₹{amt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Salary month */}
                <Text className="text-white font-pregular text-sm mb-1.5 ml-1">
                  Salary month
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mb-1"
                >
                  {recentPeriods().map((p, i) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPayForm((f) => ({ ...f, period: p }))}
                      className={`px-3 py-2.5 rounded-xl border-2 mr-2 ${
                        payForm.period === p
                          ? "border-yellow-400 bg-[#2a2412]"
                          : "border-gray-700 bg-darkinputbg"
                      }`}
                    >
                      <Text
                        className={`text-xs font-pmedium ${
                          payForm.period === p
                            ? "text-yellow-400"
                            : "text-gray-400"
                        }`}
                      >
                        {i === 0 ? "This month" : formatMonthShort(p)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text className="text-gray-600 text-xs mb-4 ml-1">
                  Which month's salary this counts against —{" "}
                  {formatMonth(payForm.period)}
                </Text>

                {/* Balance preview */}
                {amountNum > 0 && (
                  <View className="border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-4">
                    <Text className="text-gray-500 text-xs mb-1">
                      After this {payForm.type}
                    </Text>
                    {isCurrentPeriod ? (
                      <Text className="text-white font-pmedium text-sm">
                        Balance becomes{" "}
                        <Text
                          className={
                            projectedBalance > 0
                              ? "text-yellow-400"
                              : "text-green-400"
                          }
                        >
                          {money(projectedBalance)}
                        </Text>
                        {projectedBalance < 0 && (
                          <Text className="text-red-400">
                            {" "}
                            — overpaid by {money(Math.abs(projectedBalance))}
                          </Text>
                        )}
                      </Text>
                    ) : (
                      <Text className="text-white font-pmedium text-sm">
                        Applied to {formatMonth(payForm.period)}, not this month
                      </Text>
                    )}
                  </View>
                )}

                {/* Paid on */}
                <Text className="text-white font-pregular text-sm mb-1.5 ml-1">
                  Paid on
                </Text>
                <View className="border-2 border-[#665524] rounded-xl px-3 mb-1">
                  <TextInput
                    className="text-white font-pmedium"
                    style={{ height: 48 }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#6b6b6b"
                    value={payForm.paid_on}
                    onChangeText={(t) =>
                      setPayForm((p) => ({ ...p, paid_on: t }))
                    }
                  />
                </View>
                <View className="flex-row gap-2 mb-4">
                  <TouchableOpacity
                    onPress={() =>
                      setPayForm((p) => ({ ...p, paid_on: todayISO() }))
                    }
                    className="px-3 h-9 rounded-lg border border-gray-700 bg-darkinputbg items-center justify-center"
                  >
                    <Text className="text-gray-400 text-xs font-pmedium">
                      Today
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Method */}
                <Text className="text-white font-pregular text-sm mb-1.5 ml-1">
                  Method
                </Text>
                <View className="flex-row gap-2 mb-4">
                  {METHODS.map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setPayForm((p) => ({ ...p, method: m }))}
                      className={`flex-1 h-10 rounded-lg border items-center justify-center ${
                        payForm.method === m
                          ? "border-yellow-400 bg-[#2a2412]"
                          : "border-gray-700 bg-darkinputbg"
                      }`}
                    >
                      <Text
                        className={`text-xs font-pmedium capitalize ${
                          payForm.method === m
                            ? "text-yellow-400"
                            : "text-gray-400"
                        }`}
                      >
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Note */}
                <Text className="text-white font-pregular text-sm mb-1.5 ml-1">
                  Note
                </Text>
                <View className="border-2 border-[#665524] rounded-xl px-3 mb-2">
                  <TextInput
                    className="text-white font-pmedium"
                    style={{ height: 48 }}
                    placeholder="Optional — e.g. festival advance"
                    placeholderTextColor="#6b6b6b"
                    value={payForm.note}
                    onChangeText={(t) => setPayForm((p) => ({ ...p, note: t }))}
                  />
                </View>
              </ScrollView>

              <TouchableOpacity
                onPress={handleRecordPayment}
                disabled={submitting || !payForm.amount}
                className={`h-14 rounded-xl items-center justify-center mt-3 ${
                  submitting || !payForm.amount ? "bg-gray-800" : "bg-yellow-500"
                }`}
              >
                {submitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text
                    className={`font-psemibold text-base ${
                      payForm.amount ? "text-black" : "text-gray-500"
                    }`}
                  >
                    {payForm.amount
                      ? `Record ${money(amountNum)} ${payForm.type}`
                      : "Enter an amount"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}