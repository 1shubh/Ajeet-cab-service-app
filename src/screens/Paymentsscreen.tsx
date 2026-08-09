import {
  View,
  Text,
  Image,
  FlatList,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Modal,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import React, { useEffect, useState, useMemo } from "react";
import { router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppDispatch, RootState } from "@/redux/store";
import {
  fetchFeeStatuses,
  fetchPayments,
  recordFeePayment,
  deleteFeePayment,
  clearFeeSubmitState,
  currentFeePeriod,
  todayLocal,
  recentFeePeriods,
  StudentFeeStatus,
  FeeMethod,
} from "@/redux/slice/feeSlice";
import { useAlert } from "@/components/AlertProvider";

const METHODS: FeeMethod[] = ["cash", "upi", "card", "bank", "cheque"];

const money = (n: number | string) =>
  `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const monthName = (p: string) => {
  const [y, m] = p.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
};

const monthShort = (p: string) => {
  const [y, m] = p.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

type Filter = "all" | "unpaid" | "partial" | "paid";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "partial", label: "Partial" },
  { key: "paid", label: "Paid" },
];

// ============================================================
const StudentRow = ({
  s,
  onCollect,
}: {
  s: StudentFeeStatus;
  onCollect: () => void;
}) => {
  const paid = Number(s.paid);
  const fee = Number(s.monthly_fee);
  const balance = Number(s.balance);
  const settled = balance <= 0;
  const partial = paid > 0 && balance > 0;

  const initials = s.student_name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View className="border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-2">
      <View className="flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => router.push(`/student/${s.student_id}`)}
          className="w-12 h-12 rounded-full border border-yellow-400/40 overflow-hidden items-center justify-center bg-[#1a1a2e]"
        >
          {s.student_photo ? (
            <Image
              source={{ uri: s.student_photo }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Text className="text-yellow-400 font-psemibold text-xs">
              {initials}
            </Text>
          )}
        </TouchableOpacity>

        <View className="flex-1">
          <Text
            className="text-white font-pmedium text-sm"
            numberOfLines={1}
            maxFontSizeMultiplier={1}
          >
            {s.student_name}
          </Text>
          <Text className="text-gray-500 text-xs" numberOfLines={1}>
            {s.route_name ?? "No route"} · {s.parent_name}
          </Text>
        </View>

        <View className="items-end">
          <Text
            className={`font-psemibold text-sm ${
              settled ? "text-green-400" : partial ? "text-yellow-400" : "text-red-400"
            }`}
            maxFontSizeMultiplier={1}
          >
            {settled ? "Paid" : money(balance)}
          </Text>
          <Text className="text-gray-600 text-xs">
            {settled
              ? s.last_paid_on
                ? formatDate(s.last_paid_on)
                : ""
              : `of ${money(fee)}`}
          </Text>
        </View>
      </View>

      {partial && (
        <View className="mt-2.5">
          <View className="bg-gray-800 rounded-full h-1.5">
            <View
              className="bg-yellow-400 rounded-full h-1.5"
              style={{ width: `${Math.min(100, (paid / fee) * 100)}%` }}
            />
          </View>
          <Text className="text-gray-600 text-xs mt-1">
            {money(paid)} received in {s.payment_count} payment
            {s.payment_count === 1 ? "" : "s"}
          </Text>
        </View>
      )}

      {!settled && (
        <TouchableOpacity
          onPress={onCollect}
          className="bg-yellow-500 h-10 rounded-xl items-center justify-center mt-3 flex-row gap-1.5"
        >
          <Ionicons name="cash-outline" size={14} color="#000" />
          <Text className="text-black font-psemibold text-xs">
            Record payment
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ============================================================
export default function PaymentsScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { alert, confirm, toast } = useAlert();

  const {
    statuses,
    statusesLoading,
    payments,
    paymentsLoading,
    submitting,
    submitError,
  } = useSelector((s: RootState) => s.fees);
  const { profile } = useSelector((s: RootState) => s.profile);

  const [period, setPeriod] = useState(currentFeePeriod());
  const [tab, setTab] = useState<"students" | "ledger">("students");
  const [filter, setFilter] = useState<Filter>("unpaid");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [payModal, setPayModal] = useState(false);
  const [target, setTarget] = useState<StudentFeeStatus | null>(null);
  const [form, setForm] = useState({
    amount: "",
    paid_on: todayLocal(),
    method: "cash" as FeeMethod,
    note: "",
  });

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    dispatch(fetchFeeStatuses({ period }));
    dispatch(fetchPayments({ period }));
  }, [period]);

  useEffect(() => {
    if (submitError) {
      alert("Couldn't complete that", submitError, undefined, {
        tone: "danger",
      });
      dispatch(clearFeeSubmitState());
    }
  }, [submitError]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchFeeStatuses({ period })),
      dispatch(fetchPayments({ period })),
    ]);
    setRefreshing(false);
  };

  // ----------------------------------------------------------
  const filtered = useMemo(() => {
    let list = statuses;

    if (filter === "unpaid") list = list.filter((s) => Number(s.paid) === 0);
    else if (filter === "partial")
      list = list.filter(
        (s) => Number(s.paid) > 0 && Number(s.balance) > 0
      );
    else if (filter === "paid") list = list.filter((s) => Number(s.balance) <= 0);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.student_name.toLowerCase().includes(q) ||
          s.parent_name.toLowerCase().includes(q) ||
          s.parent_phone.includes(q)
      );
    }

    // Largest outstanding first — that's the follow-up order
    return [...list].sort((a, b) => Number(b.balance) - Number(a.balance));
  }, [statuses, filter, search]);

  const totals = useMemo(() => {
    const billed = statuses.reduce((t, s) => t + Number(s.monthly_fee), 0);
    const collected = statuses.reduce(
      (t, s) => t + Math.min(Number(s.paid), Number(s.monthly_fee)),
      0
    );
    const pending = statuses.reduce(
      (t, s) => t + Math.max(Number(s.balance), 0),
      0
    );
    return { billed, collected, pending };
  }, [statuses]);

  // ----------------------------------------------------------
  const openCollect = (s: StudentFeeStatus) => {
    setTarget(s);
    setForm({
      amount: String(Math.max(0, Number(s.balance))),
      paid_on: todayLocal(),
      method: "cash",
      note: "",
    });
    setPayModal(true);
  };

  const handleRecord = async () => {
    if (!target) return;
    const amount = Number(form.amount);

    if (!amount || amount <= 0) {
      toast("Enter an amount", "warning");
      return;
    }

    const result = await dispatch(
      recordFeePayment({
        student_id: target.student_id,
        amount,
        period,
        paid_on: form.paid_on,
        method: form.method,
        note: form.note,
      })
    );

    if (recordFeePayment.fulfilled.match(result)) {
      setPayModal(false);
      dispatch(fetchFeeStatuses({ period }));
      toast(`${money(amount)} from ${target.student_name}`);
    }
  };

  const handleDelete = async (id: string, amount: number, name?: string) => {
    const ok = await confirm({
      title: "Delete this payment?",
      message: `${money(amount)}${name ? ` from ${name}` : ""} will be removed and the balance recalculated.`,
      confirmText: "Delete",
      tone: "danger",
    });

    if (!ok) return;

    const result = await dispatch(deleteFeePayment(id));
    if (deleteFeePayment.fulfilled.match(result)) {
      dispatch(fetchFeeStatuses({ period }));
      toast("Payment deleted");
    }
  };

  const amountNum = Number(form.amount) || 0;
  const remainingAfter = target
    ? Number(target.balance) - amountNum
    : 0;

  // ----------------------------------------------------------
  return (
    <>
      <View className="flex-1 bg-appBg" style={{ paddingTop: insets.top + 12 }}>
        <View className="px-3">
          {/* Header */}
          <View className="flex-row items-center gap-3 mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full border border-[#665524] items-center justify-center"
            >
              <Ionicons name="arrow-back" size={16} color="#FACC15" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white font-psemibold text-lg">
                Fee payments
              </Text>
              <Text className="text-gray-500 text-xs">
                {monthName(period)}
              </Text>
            </View>
          </View>

          {/* Month picker */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-3"
          >
            {recentFeePeriods(12).map((p, i) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                className={`px-3 py-2 rounded-xl border-2 mr-2 ${
                  period === p
                    ? "border-yellow-400 bg-[#2a2412]"
                    : "border-gray-700 bg-darkinputbg"
                }`}
              >
                <Text
                  className={`text-xs font-pmedium ${
                    period === p ? "text-yellow-400" : "text-gray-400"
                  }`}
                >
                  {i === 0 ? "This month" : monthShort(p)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Summary */}
          <View className="border border-yellow-300 bg-darkinputbg rounded-xl p-4 mb-3">
            <View className="flex-row justify-between items-end mb-3">
              <View>
                <Text className="text-gray-500 text-xs mb-0.5">Collected</Text>
                <Text className="text-green-400 text-2xl font-psemibold">
                  {money(totals.collected)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-gray-500 text-xs mb-0.5">Pending</Text>
                <Text
                  className={`text-xl font-psemibold ${
                    totals.pending > 0 ? "text-red-400" : "text-green-400"
                  }`}
                >
                  {money(totals.pending)}
                </Text>
              </View>
            </View>
            <View className="bg-gray-800 rounded-full h-2">
              <View
                className="bg-green-400 rounded-full h-2"
                style={{
                  width: `${
                    totals.billed > 0
                      ? Math.min(
                          100,
                          Math.round((totals.collected / totals.billed) * 100)
                        )
                      : 0
                  }%`,
                }}
              />
            </View>
            <Text className="text-gray-600 text-xs mt-2">
              {money(totals.billed)} billed across {statuses.length} student
              {statuses.length === 1 ? "" : "s"}
            </Text>
          </View>

          {/* Tabs */}
          <View className="flex-row gap-2 mb-3">
            {(["students", "ledger"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                className={`flex-1 h-10 rounded-xl items-center justify-center border ${
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
                  {t === "students" ? "By student" : "All payments"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === "students" && (
            <>
              <View className="border-2 border-[#665524] rounded-xl px-3 mb-3 flex-row items-center gap-2">
                <Ionicons name="search" size={16} color="#6b6b6b" />
                <TextInput
                  className="flex-1 text-white font-pmedium"
                  style={{ height: 42 }}
                  placeholder="Search student or parent"
                  placeholderTextColor="#6b6b6b"
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

              <View className="flex-row gap-2 mb-3">
                {FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    className={`px-3 py-2 rounded-xl border ${
                      filter === f.key
                        ? "border-yellow-400 bg-[#2a2412]"
                        : "border-gray-700 bg-darkinputbg"
                    }`}
                  >
                    <Text
                      className={`text-xs font-pmedium ${
                        filter === f.key ? "text-yellow-400" : "text-gray-400"
                      }`}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        {/* ---------------- BY STUDENT ---------------- */}
        {tab === "students" ? (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.student_id}
            renderItem={({ item }) => (
              <StudentRow
                s={item}
                onCollect={() => (isAdmin ? openCollect(item) : null)}
              />
            )}
            contentContainerStyle={{
              paddingHorizontal: 12,
              paddingBottom: insets.bottom + 24,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FACC15"
              />
            }
            ListEmptyComponent={
              statusesLoading ? (
                <ActivityIndicator color="#FACC15" className="mt-10" />
              ) : (
                <View className="items-center mt-16 px-8">
                  <Text className="text-gray-300 font-pmedium text-base mb-2">
                    {filter === "unpaid"
                      ? "Everyone has paid"
                      : "Nothing here"}
                  </Text>
                  <Text className="text-gray-600 text-xs text-center">
                    {filter === "unpaid"
                      ? `All fees for ${monthName(period)} are settled.`
                      : "Try a different filter or month."}
                  </Text>
                </View>
              )
            }
          />
        ) : (
          /* ---------------- LEDGER ---------------- */
          <FlatList
            data={payments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: 12,
              paddingBottom: insets.bottom + 24,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FACC15"
              />
            }
            renderItem={({ item }) => (
              <View className="border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-2 flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-green-400 font-psemibold text-sm">
                      +{money(item.amount)}
                    </Text>
                    {item.method && (
                      <View className="bg-gray-800 px-2 py-0.5 rounded-full">
                        <Text className="text-gray-400 text-xs capitalize">
                          {item.method}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    className="text-white text-xs font-pmedium mt-1"
                    numberOfLines={1}
                  >
                    {item.students?.student_name ?? "Unknown student"}
                  </Text>
                  <Text className="text-gray-500 text-xs mt-0.5">
                    {formatDate(item.paid_on)}
                    {item.collector?.name ? ` · by ${item.collector.name}` : ""}
                  </Text>
                  {item.note ? (
                    <Text className="text-gray-600 text-xs mt-1">
                      {item.note}
                    </Text>
                  ) : null}
                </View>

                {isAdmin && (
                  <TouchableOpacity
                    onPress={() =>
                      handleDelete(
                        item.id,
                        item.amount,
                        item.students?.student_name
                      )
                    }
                    hitSlop={10}
                    className="w-7 h-7 items-center justify-center"
                  >
                    <Ionicons name="trash-outline" size={15} color="#F87171" />
                  </TouchableOpacity>
                )}
              </View>
            )}
            ListEmptyComponent={
              paymentsLoading ? (
                <ActivityIndicator color="#FACC15" className="mt-10" />
              ) : (
                <View className="items-center mt-16 px-8">
                  <Text className="text-gray-300 font-pmedium text-base mb-2">
                    No payments yet
                  </Text>
                  <Text className="text-gray-600 text-xs text-center">
                    Nothing recorded for {monthName(period)}.
                  </Text>
                </View>
              )
            }
          />
        )}
      </View>

      {/* ---------------- COLLECT SHEET ---------------- */}
      <Modal
        visible={payModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setPayModal(false)}
      >
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
          >
            <View
              className="bg-[#0F1B24] border-t border-[#665524] rounded-t-3xl px-5 pt-3"
              style={{ paddingBottom: insets.bottom + 20 }}
            >
              <View className="w-10 h-1 bg-gray-700 rounded-full self-center mb-4" />

              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-1">
                  <Text
                    className="text-white font-psemibold text-base"
                    numberOfLines={1}
                  >
                    {target?.student_name}
                  </Text>
                  <Text className="text-gray-500 text-xs mt-0.5">
                    {monthName(period)} · {money(target?.balance ?? 0)} due
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
                style={{ maxHeight: Dimensions.get("window").height * 0.45 }}
              >
                <Text className="text-white font-pregular text-sm mb-1.5 ml-1">
                  Amount received
                </Text>
                <View className="border-2 border-[#665524] rounded-xl flex-row items-center px-3 mb-3">
                  <Text className="text-gray-400 font-pmedium mr-1 text-lg">
                    ₹
                  </Text>
                  <TextInput
                    className="flex-1 text-white font-psemibold text-lg"
                    style={{ height: 52 }}
                    placeholder="0"
                    placeholderTextColor="#6b6b6b"
                    keyboardType="numeric"
                    value={form.amount}
                    onChangeText={(t) =>
                      setForm((p) => ({
                        ...p,
                        amount: t.replace(/[^0-9]/g, ""),
                      }))
                    }
                  />
                </View>

                {/* Quick fills relative to what's owed */}
                <View className="flex-row gap-2 mb-3">
                  <TouchableOpacity
                    onPress={() =>
                      setForm((p) => ({
                        ...p,
                        amount: String(Math.max(0, Number(target?.balance ?? 0))),
                      }))
                    }
                    className="flex-1 h-10 rounded-lg border border-yellow-400 bg-[#2a2412] items-center justify-center"
                  >
                    <Text className="text-yellow-400 text-xs font-pmedium">
                      Full {money(target?.balance ?? 0)}
                    </Text>
                  </TouchableOpacity>
                  {[500, 1000].map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      onPress={() =>
                        setForm((p) => ({ ...p, amount: String(amt) }))
                      }
                      className="flex-1 h-10 rounded-lg border border-gray-700 bg-darkinputbg items-center justify-center"
                    >
                      <Text className="text-gray-400 text-xs font-pmedium">
                        ₹{amt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {amountNum > 0 && (
                  <View className="border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-4">
                    <Text className="text-gray-500 text-xs mb-1">
                      After this payment
                    </Text>
                    <Text className="text-white font-pmedium text-sm">
                      {remainingAfter > 0 ? (
                        <>
                          <Text className="text-yellow-400">
                            {money(remainingAfter)}
                          </Text>{" "}
                          still due
                        </>
                      ) : remainingAfter === 0 ? (
                        <Text className="text-green-400">Fully settled</Text>
                      ) : (
                        <>
                          <Text className="text-blue-400">
                            {money(Math.abs(remainingAfter))}
                          </Text>{" "}
                          overpaid — carry it forward manually
                        </>
                      )}
                    </Text>
                  </View>
                )}

                <Text className="text-white font-pregular text-sm mb-1.5 ml-1">
                  Received on
                </Text>
                <View className="border-2 border-[#665524] rounded-xl px-3 mb-2">
                  <TextInput
                    className="text-white font-pmedium"
                    style={{ height: 48 }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#6b6b6b"
                    value={form.paid_on}
                    onChangeText={(t) =>
                      setForm((p) => ({ ...p, paid_on: t }))
                    }
                  />
                </View>
                <TouchableOpacity
                  onPress={() =>
                    setForm((p) => ({ ...p, paid_on: todayLocal() }))
                  }
                  className="px-3 h-9 rounded-lg border border-gray-700 bg-darkinputbg items-center justify-center self-start mb-4"
                >
                  <Text className="text-gray-400 text-xs font-pmedium">
                    Today
                  </Text>
                </TouchableOpacity>

                <Text className="text-white font-pregular text-sm mb-1.5 ml-1">
                  Method
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {METHODS.map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setForm((p) => ({ ...p, method: m }))}
                      className={`px-4 h-10 rounded-lg border items-center justify-center ${
                        form.method === m
                          ? "border-yellow-400 bg-[#2a2412]"
                          : "border-gray-700 bg-darkinputbg"
                      }`}
                    >
                      <Text
                        className={`text-xs font-pmedium capitalize ${
                          form.method === m ? "text-yellow-400" : "text-gray-400"
                        }`}
                      >
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text className="text-white font-pregular text-sm mb-1.5 ml-1">
                  Note
                </Text>
                <View className="border-2 border-[#665524] rounded-xl px-3 mb-2">
                  <TextInput
                    className="text-white font-pmedium"
                    style={{ height: 48 }}
                    placeholder="Optional — receipt number, remarks"
                    placeholderTextColor="#6b6b6b"
                    value={form.note}
                    onChangeText={(t) => setForm((p) => ({ ...p, note: t }))}
                  />
                </View>
              </ScrollView>

              <TouchableOpacity
                onPress={handleRecord}
                disabled={submitting || !form.amount}
                className={`h-14 rounded-xl items-center justify-center mt-3 ${
                  submitting || !form.amount ? "bg-gray-800" : "bg-yellow-500"
                }`}
              >
                {submitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text
                    className={`font-psemibold text-base ${
                      form.amount ? "text-black" : "text-gray-500"
                    }`}
                  >
                    {form.amount
                      ? `Record ${money(amountNum)}`
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