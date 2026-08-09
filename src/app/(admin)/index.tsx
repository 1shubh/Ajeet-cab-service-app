import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppDispatch, RootState } from "@/redux/store";
import { images } from "@/constants/images";
import { fetchUserProfile } from "@/redux/slice/userdetails";
import {
  fetchDashboard,
  fetchTrend,
  currentFeePeriod,
} from "@/redux/slice/feeSlice";

const money = (n: number | string) =>
  `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const compactMoney = (n: number | string) => {
  const v = Number(n);
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${v}`;
};

const monthName = (period: string) => {
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
};

const monthShort = (period: string) => {
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-IN", {
    month: "short",
  });
};

// ============================================================
const SectionLabel = ({
  label,
  action,
  onAction,
}: {
  label: string;
  action?: string;
  onAction?: () => void;
}) => (
  <View className="flex-row items-center justify-between mt-5 mb-2">
    <Text className="text-gray-500 text-xs uppercase tracking-widest">
      {label}
    </Text>
    {action && (
      <TouchableOpacity onPress={onAction} hitSlop={8}>
        <Text className="text-yellow-400 text-xs font-pmedium">{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const StatCard = ({
  label,
  value,
  accent = "text-white",
  icon,
  onPress,
}: {
  label: string;
  value: string | number;
  accent?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) => {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      className="border border-gray-700 bg-darkinputbg rounded-xl p-3 flex-1"
    >
      {icon && (
        <Ionicons name={icon} size={16} color="#6b7280" style={{ marginBottom: 4 }} />
      )}
      <Text
        className={`text-xl font-psemibold ${accent}`}
        maxFontSizeMultiplier={1}
      >
        {value}
      </Text>
      <Text
        className="text-gray-500 text-xs mt-0.5"
        maxFontSizeMultiplier={1}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Wrapper>
  );
};

const AlertCard = ({
  tone,
  title,
  subtitle,
  onPress,
}: {
  tone: "warning" | "danger" | "success" | "info";
  title: string;
  subtitle: string;
  onPress?: () => void;
}) => {
  const style = {
    warning: { box: "border-yellow-800 bg-yellow-950", t: "text-yellow-300", s: "text-yellow-700", i: "warning" as const, c: "#FACC15" },
    danger: { box: "border-red-900 bg-red-950", t: "text-red-300", s: "text-red-800", i: "alert-circle" as const, c: "#F87171" },
    success: { box: "border-green-900 bg-green-950", t: "text-green-300", s: "text-green-800", i: "checkmark-circle" as const, c: "#34D399" },
    info: { box: "border-blue-900 bg-blue-950", t: "text-blue-300", s: "text-blue-800", i: "information-circle" as const, c: "#60A5FA" },
  }[tone];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      className={`border rounded-xl p-3 mb-2 flex-row items-center gap-3 ${style.box}`}
    >
      <Ionicons name={style.i} size={18} color={style.c} />
      <View className="flex-1">
        <Text className={`text-xs font-psemibold ${style.t}`} maxFontSizeMultiplier={1}>
          {title}
        </Text>
        <Text className={`text-xs ${style.s}`} maxFontSizeMultiplier={1}>
          {subtitle}
        </Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={14} color={style.c} />}
    </TouchableOpacity>
  );
};

const QuickAction = ({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    className="items-center flex-1 gap-1.5"
  >
    <View className="w-12 h-12 rounded-xl bg-[#2a2412] border border-[#665524] items-center justify-center">
      <Ionicons name={icon} size={20} color="#FACC15" />
    </View>
    <Text className="text-gray-400 text-xs" numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ============================================================
export default function AdminHome() {
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();

  const { profile } = useSelector((s: RootState) => s.profile);
  const { dashboard, dashboardLoading, dashboardError, trend } = useSelector(
    (s: RootState) => s.fees
  );

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!profile) dispatch(fetchUserProfile());
    dispatch(fetchDashboard());
    dispatch(fetchTrend(6));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchDashboard()),
      dispatch(fetchTrend(6)),
      dispatch(fetchUserProfile()),
    ]);
    setRefreshing(false);
  };

  if (dashboardLoading && !dashboard) {
    return (
      <View className="flex-1 bg-appBg items-center justify-center">
        <ActivityIndicator color="#FACC15" size="large" />
      </View>
    );
  }

  const d = dashboard;
  const maxTrend = Math.max(...trend.map((t) => Number(t.collected)), 1);

  return (
    <ScrollView
      className="flex-1 bg-appBg"
      contentContainerStyle={{
        paddingHorizontal: 12,
        paddingTop: insets.top + 12,
        paddingBottom: 32,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#FACC15"
        />
      }
    >
      {/* Header */}
      <View className="flex-row justify-between items-center mb-5">
        <View className="flex-1">
          <Text className="font-pregular text-gray-400 text-xs">
            Welcome back
          </Text>
          <View className="flex-row items-center gap-1.5">
            <Text
              className="font-psemibold text-yellow-400 text-base"
              numberOfLines={1}
            >
              {profile?.name ?? "—"}
            </Text>
            <Text className="text-xs text-yellow-100/60 capitalize">
              ({profile?.role})
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/(admin)/profile")}
          className="border border-yellow-300 w-12 h-12 rounded-full overflow-hidden items-center justify-center"
        >
          {profile?.profile_image ? (
            <Image
              source={{ uri: profile.profile_image }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Image
              source={images.noimage}
              className="w-7 h-7"
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </View>

      {/* ---------------- FEES HERO ---------------- */}
      <TouchableOpacity
        onPress={() => router.push("/payments")}
        className="border border-yellow-300 bg-darkinputbg rounded-2xl p-4 mb-3"
      >
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-gray-400 text-xs">
            Fees collected · {monthName(d?.period ?? currentFeePeriod())}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#6b7280" />
        </View>

        <Text className="text-yellow-400 text-3xl font-psemibold mb-1">
          {money(d?.fees.collected ?? 0)}
        </Text>
        <Text className="text-gray-500 text-xs mb-3">
          of {money(d?.fees.billed ?? 0)} billed
        </Text>

        <View className="bg-gray-800 rounded-full h-2 mb-2">
          <View
            className="bg-green-400 rounded-full h-2"
            style={{ width: `${Math.min(100, d?.fees.percent ?? 0)}%` }}
          />
        </View>

        <View className="flex-row justify-between">
          <Text className="text-gray-500 text-xs">
            {d?.fees.percent ?? 0}% collected
          </Text>
          <Text
            className={`text-xs font-pmedium ${
              (d?.fees.pending ?? 0) > 0 ? "text-red-400" : "text-green-400"
            }`}
          >
            {(d?.fees.pending ?? 0) > 0
              ? `${money(d!.fees.pending)} pending`
              : "All settled"}
          </Text>
        </View>

        {(d?.fees.pending_students ?? 0) > 0 && (
          <Text className="text-gray-600 text-xs mt-2">
            {d!.fees.pending_students} student
            {d!.fees.pending_students === 1 ? "" : "s"} yet to pay
          </Text>
        )}
      </TouchableOpacity>

      {/* Collection trend */}
      {trend.length > 0 && (
        <View className="border border-gray-700 bg-darkinputbg rounded-xl p-4 mb-3">
          <Text className="text-gray-400 text-xs mb-3">
            Collection over 6 months
          </Text>
          <View className="flex-row items-end justify-between gap-2 h-24">
            {trend.map((t, i) => {
              const h = Math.max(
                4,
                (Number(t.collected) / maxTrend) * 80
              );
              const isCurrent = i === trend.length - 1;
              return (
                <View key={t.period} className="flex-1 items-center gap-1.5">
                  <Text className="text-gray-600 text-xs" numberOfLines={1}>
                    {Number(t.collected) > 0
                      ? compactMoney(t.collected)
                      : ""}
                  </Text>
                  <View
                    className={`w-full rounded-t ${
                      isCurrent ? "bg-yellow-400" : "bg-gray-700"
                    }`}
                    style={{ height: h }}
                  />
                  <Text
                    className={`text-xs ${
                      isCurrent ? "text-yellow-400" : "text-gray-600"
                    }`}
                  >
                    {monthShort(t.period)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ---------------- QUICK ACTIONS ---------------- */}
      <View className="flex-row gap-2 border border-gray-700 bg-darkinputbg rounded-xl p-4 mb-1">
        <QuickAction
          icon="person-add"
          label="Admit"
          onPress={() => router.push("/add-student")}
        />
        <QuickAction
          icon="cash"
          label="Fee"
          onPress={() => router.push("/payments")}
        />
        <QuickAction
          icon="git-branch"
          label="Route"
          onPress={() => router.push("/add-route")}
        />
        <QuickAction
          icon="bus"
          label="Vehicle"
          onPress={() => router.push("/add-vehicle")}
        />
      </View>

      {/* ---------------- STUDENTS ---------------- */}
      <SectionLabel
        label="Students"
        action="View all"
        onAction={() => router.push("/(admin)/students")}
      />
      <View className="flex-row gap-2 mb-2">
        <StatCard
          label="Active"
          value={d?.students.active ?? 0}
          accent="text-white"
          onPress={() => router.push("/(admin)/students")}
        />
        <StatCard
          label="Pending route"
          value={d?.students.pending ?? 0}
          accent={
            (d?.students.pending ?? 0) > 0 ? "text-yellow-400" : "text-white"
          }
          onPress={() => router.push("/(admin)/students")}
        />
        <StatCard
          label="New this month"
          value={d?.students.new_this_month ?? 0}
          accent="text-green-400"
        />
      </View>

      {/* ---------------- DRIVERS & PAYROLL ---------------- */}
      <SectionLabel
        label="Drivers"
        action="Manage"
        onAction={() => router.push("/(admin)/drivers")}
      />
      <View className="flex-row gap-2 mb-2">
        <StatCard label="Total" value={d?.drivers.total ?? 0} />
        <StatCard
          label="Active"
          value={d?.drivers.active ?? 0}
          accent="text-green-400"
        />
        <StatCard
          label="On leave"
          value={d?.drivers.on_leave ?? 0}
          accent={
            (d?.drivers.on_leave ?? 0) > 0 ? "text-yellow-400" : "text-white"
          }
        />
        <StatCard
          label="Inactive"
          value={d?.drivers.inactive ?? 0}
          accent={
            (d?.drivers.inactive ?? 0) > 0 ? "text-red-400" : "text-white"
          }
        />
      </View>

      <TouchableOpacity
        onPress={() => router.push("/(admin)/drivers")}
        className="border border-gray-700 bg-darkinputbg rounded-xl p-4 mb-2"
      >
        <Text className="text-gray-400 text-xs mb-2">
          Payroll · {monthName(d?.period ?? currentFeePeriod())}
        </Text>
        <View className="flex-row justify-between items-end mb-3">
          <View>
            <Text className="text-gray-500 text-xs mb-0.5">Paid</Text>
            <Text className="text-green-400 text-lg font-psemibold">
              {money(d?.payroll.total_paid ?? 0)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-gray-500 text-xs mb-0.5">Outstanding</Text>
            <Text
              className={`text-lg font-psemibold ${
                (d?.payroll.outstanding ?? 0) > 0
                  ? "text-red-400"
                  : "text-green-400"
              }`}
            >
              {money(d?.payroll.outstanding ?? 0)}
            </Text>
          </View>
        </View>
        <View className="bg-gray-800 rounded-full h-2">
          <View
            className="bg-green-400 rounded-full h-2"
            style={{
              width: `${
                Number(d?.payroll.total_salary ?? 0) > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (Number(d!.payroll.total_paid) /
                          Number(d!.payroll.total_salary)) *
                          100
                      )
                    )
                  : 0
              }%`,
            }}
          />
        </View>
        <Text className="text-gray-600 text-xs mt-2">
          {money(d?.payroll.total_salary ?? 0)} total monthly salary
        </Text>
      </TouchableOpacity>

      {/* ---------------- FLEET & ROUTES ---------------- */}
      <SectionLabel
        label="Fleet & routes"
        action="Manage"
        onAction={() => router.push("/(admin)/vehicles")}
      />
      <View className="flex-row gap-2 mb-2">
        <StatCard
          label="Vehicles"
          value={d?.fleet.active ?? 0}
          onPress={() => router.push("/(admin)/vehicles")}
        />
        <StatCard
          label="Unassigned"
          value={d?.fleet.unassigned ?? 0}
          accent={
            (d?.fleet.unassigned ?? 0) > 0 ? "text-yellow-400" : "text-white"
          }
          onPress={() => router.push("/(admin)/vehicles")}
        />
        <StatCard
          label="Routes"
          value={d?.routes.active ?? 0}
          onPress={() => router.push("/(admin)/routes")}
        />
      </View>

      {/* ---------------- ALERTS ---------------- */}
      {(() => {
        const alerts: React.ReactNode[] = [];

        if ((d?.fleet.service_due ?? 0) > 0)
          alerts.push(
            <AlertCard
              key="service"
              tone="danger"
              title={`${d!.fleet.service_due} vehicle${d!.fleet.service_due === 1 ? "" : "s"} overdue for service`}
              subtitle="Next service date has passed"
              onPress={() => router.push("/(admin)/vehicles")}
            />
          );

        if ((d?.fleet.docs_expiring ?? 0) > 0)
          alerts.push(
            <AlertCard
              key="vdocs"
              tone="warning"
              title={`${d!.fleet.docs_expiring} vehicle${d!.fleet.docs_expiring === 1 ? "" : "s"} with expiring documents`}
              subtitle="Insurance, fitness, permit or PUC within 30 days"
              onPress={() => router.push("/(admin)/vehicles")}
            />
          );

        if ((d?.drivers.docs_expiring ?? 0) > 0)
          alerts.push(
            <AlertCard
              key="ddocs"
              tone="warning"
              title={`${d!.drivers.docs_expiring} driver licence${d!.drivers.docs_expiring === 1 ? "" : "s"} expiring`}
              subtitle="Within the next 30 days"
              onPress={() => router.push("/(admin)/drivers")}
            />
          );

        if ((d?.students.unassigned ?? 0) > 0)
          alerts.push(
            <AlertCard
              key="unassigned"
              tone="info"
              title={`${d!.students.unassigned} active student${d!.students.unassigned === 1 ? "" : "s"} without a route`}
              subtitle="Assign a route so they're counted properly"
              onPress={() => router.push("/(admin)/students")}
            />
          );

        if ((d?.fees.pending_students ?? 0) > 0)
          alerts.push(
            <AlertCard
              key="fees"
              tone="danger"
              title={`${money(d!.fees.pending)} in unpaid fees`}
              subtitle={`Across ${d!.fees.pending_students} student${d!.fees.pending_students === 1 ? "" : "s"} this month`}
              onPress={() => router.push("/payments")}
            />
          );

        if ((d?.fleet.unassigned ?? 0) > 0)
          alerts.push(
            <AlertCard
              key="vunassigned"
              tone="info"
              title={`${d!.fleet.unassigned} vehicle${d!.fleet.unassigned === 1 ? "" : "s"} without a driver`}
              subtitle="Sitting idle in the fleet"
              onPress={() => router.push("/(admin)/vehicles")}
            />
          );

        if (alerts.length === 0) {
          return (
            <>
              <SectionLabel label="Alerts" />
              <View className="border border-green-900 bg-green-950 rounded-xl p-4 flex-row items-center gap-3">
                <Ionicons name="checkmark-circle" size={20} color="#34D399" />
                <View className="flex-1">
                  <Text className="text-green-300 text-xs font-psemibold">
                    Everything looks fine
                  </Text>
                  <Text className="text-green-800 text-xs">
                    No overdue services, expiring documents or unpaid fees.
                  </Text>
                </View>
              </View>
            </>
          );
        }

        return (
          <>
            <SectionLabel label={`Alerts (${alerts.length})`} />
            {alerts}
          </>
        );
      })()}

      {dashboardError && (
        <View className="border border-red-900 bg-red-950 rounded-xl p-3 mt-3">
          <Text className="text-red-300 text-xs">{dashboardError}</Text>
        </View>
      )}
    </ScrollView>
  );
}