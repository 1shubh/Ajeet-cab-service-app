import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppDispatch, RootState } from "@/redux/store";
import {
  createDriver,
  validateDriver,
  fetchVehicles,
  clearDriverSubmitState,
  DriverInput,
} from "@/redux/slice/driverSlice";
import { fetchRoutes } from "@/redux/slice/routeslice";
import { useAlert } from "@/components/AlertProvider";

// ------------------------------------------------------------
const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = "default",
  maxLength,
  prefix,
  required = true,
  multiline = false,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  error?: string;
  keyboardType?: "default" | "phone-pad" | "numeric";
  maxLength?: number;
  prefix?: string;
  required?: boolean;
  multiline?: boolean;
  hint?: string;
}) => (
  <View className="mb-4">
    <Text className="text-white font-pregular text-sm mb-1.5 ml-1">
      {label}
      {required && <Text className="text-red-400"> *</Text>}
    </Text>
    <View
      className={`border-2 rounded-xl flex-row items-center px-3 ${
        error ? "border-red-500" : "border-[#665524]"
      }`}
    >
      {prefix && (
        <Text className="text-gray-400 font-pmedium mr-1">{prefix}</Text>
      )}
      <TextInput
        className="flex-1 text-white font-pmedium"
        style={
          multiline
            ? { height: 70, textAlignVertical: "top", paddingTop: 10 }
            : { height: 48 }
        }
        placeholder={placeholder}
        placeholderTextColor="#6b6b6b"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        maxLength={maxLength}
        multiline={multiline}
        autoCapitalize={keyboardType === "phone-pad" ? "none" : "words"}
      />
    </View>
    {error ? (
      <Text className="text-red-400 text-xs mt-1 ml-1">{error}</Text>
    ) : hint ? (
      <Text className="text-gray-600 text-xs mt-1 ml-1">{hint}</Text>
    ) : null}
  </View>
);

// ------------------------------------------------------------
export default function AddDriver() {
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { alert, confirm, toast } = useAlert();

  const { submitting, submitError, vehicles } = useSelector(
    (s: RootState) => s.drivers
  );
  const { routes } = useSelector((s: RootState) => s.routes);

  const [form, setForm] = useState<DriverInput>({
    name: "",
    phone: "",
    license_number: "",
    license_expiry: "",
    monthly_salary: 0,
    address: "",
    emergency_contact: "",
    route_id: null,
    vehicle_id: null,
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    dispatch(fetchRoutes());
    dispatch(fetchVehicles());
    return () => {
      dispatch(clearDriverSubmitState());
    };
  }, []);

  useEffect(() => {
    if (submitError) {
      alert("Couldn't add driver", submitError, undefined, { tone: "danger" });
      dispatch(clearDriverSubmitState());
    }
  }, [submitError]);

  const set = (key: keyof DriverInput, value: any) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key]) {
      setErrors((p) => {
        const n = { ...p };
        delete n[key as string];
        return n;
      });
    }
  };

  const isDirty = form.name.trim() !== "" || form.phone.trim() !== "";

  const freeVehicles = vehicles.filter((v) => !v.assigned_driver_id);

  const handleSubmit = async () => {
    const v = validateDriver({
      name: form.name,
      phone: form.phone,
      monthly_salary: form.monthly_salary,
      license_expiry: form.license_expiry || undefined,
    });

    if (Object.keys(v).length > 0) {
      setErrors(v);
      toast("Check the highlighted fields", "warning");
      return;
    }

    const result = await dispatch(createDriver(form));

    if (createDriver.fulfilled.match(result)) {
      alert(
        "Driver added",
        `${result.payload.name} can now sign in with +91 ${form.phone}. Their account activates on first OTP login.`,
        [
          {
            text: "Add another",
            style: "cancel",
            onPress: () =>
              setForm({
                name: "",
                phone: "",
                license_number: "",
                license_expiry: "",
                monthly_salary: form.monthly_salary,
                address: "",
                emergency_contact: "",
                route_id: null,
                vehicle_id: null,
                notes: "",
              }),
          },
          {
            text: "Open profile",
            onPress: () =>
              router.replace(`/driver/${result.payload.driver_id}`),
          },
        ],
        { tone: "success", dismissable: false }
      );
    }
  };

  const handleBack = async () => {
    if (!isDirty) {
      router.back();
      return;
    }
    const discard = await confirm({
      title: "Discard driver?",
      message: "The details you've entered won't be saved.",
      confirmText: "Discard",
      cancelText: "Keep editing",
      tone: "danger",
    });
    if (discard) router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-appBg"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 40,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3 mb-6">
          <TouchableOpacity
            onPress={handleBack}
            className="w-10 h-10 rounded-full border border-[#665524] items-center justify-center"
          >
            <Ionicons name="arrow-back" size={16} color="#FACC15" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white font-psemibold text-lg">
              Add driver
            </Text>
            <Text className="text-gray-500 text-xs">
              They'll sign in with the number you enter
            </Text>
          </View>
        </View>

        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3">
          Personal
        </Text>

        <Field
          label="Full name"
          value={form.name}
          onChangeText={(t) => set("name", t)}
          placeholder="Suresh Kumar"
          error={errors.name}
        />
        <Field
          label="Mobile number"
          value={form.phone}
          onChangeText={(t) => set("phone", t.replace(/[^0-9]/g, ""))}
          placeholder="9876543210"
          error={errors.phone}
          keyboardType="phone-pad"
          maxLength={10}
          prefix="+91"
          hint="This becomes their login — it can't be changed later"
        />
        <Field
          label="Address"
          value={form.address ?? ""}
          onChangeText={(t) => set("address", t)}
          placeholder="House 12, Sector 9"
          required={false}
          multiline
        />
        <Field
          label="Emergency contact"
          value={form.emergency_contact ?? ""}
          onChangeText={(t) =>
            set("emergency_contact", t.replace(/[^0-9]/g, ""))
          }
          placeholder="9876543210"
          keyboardType="phone-pad"
          maxLength={10}
          prefix="+91"
          required={false}
        />

        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3 mt-2">
          License
        </Text>

        <Field
          label="License number"
          value={form.license_number ?? ""}
          onChangeText={(t) => set("license_number", t.toUpperCase())}
          placeholder="DL-1420110012345"
          required={false}
        />
        <Field
          label="Expiry date"
          value={form.license_expiry ?? ""}
          onChangeText={(t) => set("license_expiry", t)}
          placeholder="YYYY-MM-DD"
          error={errors.license_expiry}
          required={false}
          hint="You'll get an alert 30 days before this date"
        />

        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3 mt-2">
          Salary
        </Text>

        <Field
          label="Monthly salary"
          value={form.monthly_salary ? String(form.monthly_salary) : ""}
          onChangeText={(t) =>
            set("monthly_salary", Number(t.replace(/[^0-9]/g, "")) || 0)
          }
          placeholder="18000"
          keyboardType="numeric"
          prefix="₹"
          error={errors.monthly_salary}
          required={false}
          hint="Advances and payments are tracked against this"
        />

        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3 mt-2">
          Assignment
        </Text>

        <Text className="text-white font-pregular text-sm mb-1.5 ml-1">
          Route
        </Text>
        {routes?.length === 0 ? (
          <TouchableOpacity
            onPress={() => router.push("/add-route")}
            className="border border-yellow-800 bg-yellow-950 rounded-xl p-3 mb-4"
          >
            <Text className="text-yellow-300 text-xs font-pmedium mb-0.5">
              No routes exist yet
            </Text>
            <Text className="text-yellow-800 text-xs">
              Tap to create one, or assign later.
            </Text>
          </TouchableOpacity>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
          >
            <TouchableOpacity
              onPress={() => set("route_id", null)}
              className={`px-4 py-2.5 rounded-xl border-2 mr-2 ${
                !form.route_id
                  ? "border-yellow-400 bg-[#2a2412]"
                  : "border-gray-700 bg-darkinputbg"
              }`}
            >
              <Text
                className={`font-pmedium text-xs ${
                  !form.route_id ? "text-yellow-400" : "text-gray-400"
                }`}
              >
                Assign later
              </Text>
            </TouchableOpacity>
            {routes?.map((r) => (
              <TouchableOpacity
                key={r.id}
                onPress={() => set("route_id", r.id)}
                className={`px-4 py-2.5 rounded-xl border-2 mr-2 ${
                  form.route_id === r.id
                    ? "border-yellow-400 bg-[#2a2412]"
                    : "border-gray-700 bg-darkinputbg"
                }`}
              >
                <Text
                  className={`font-pmedium text-xs ${
                    form.route_id === r.id ? "text-yellow-400" : "text-gray-400"
                  }`}
                >
                  {r.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Text className="text-white font-pregular text-sm mb-1.5 ml-1">
          Vehicle
        </Text>
        {freeVehicles.length === 0 ? (
          <View className="border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-4">
            <Text className="text-gray-400 text-xs">
              {vehicles.length === 0
                ? "No vehicles added yet. You can assign one later."
                : "Every vehicle is already assigned. Free one up first."}
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
          >
            <TouchableOpacity
              onPress={() => set("vehicle_id", null)}
              className={`px-4 py-2.5 rounded-xl border-2 mr-2 ${
                !form.vehicle_id
                  ? "border-yellow-400 bg-[#2a2412]"
                  : "border-gray-700 bg-darkinputbg"
              }`}
            >
              <Text
                className={`font-pmedium text-xs ${
                  !form.vehicle_id ? "text-yellow-400" : "text-gray-400"
                }`}
              >
                Assign later
              </Text>
            </TouchableOpacity>
            {freeVehicles.map((v) => (
              <TouchableOpacity
                key={v.id}
                onPress={() => set("vehicle_id", v.id)}
                className={`px-4 py-2.5 rounded-xl border-2 mr-2 ${
                  form.vehicle_id === v.id
                    ? "border-yellow-400 bg-[#2a2412]"
                    : "border-gray-700 bg-darkinputbg"
                }`}
              >
                <Text
                  className={`font-pmedium text-xs ${
                    form.vehicle_id === v.id
                      ? "text-yellow-400"
                      : "text-gray-400"
                  }`}
                >
                  {v.bus_number}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Field
          label="Notes"
          value={form.notes ?? ""}
          onChangeText={(t) => set("notes", t)}
          placeholder="Prefers morning shift"
          required={false}
          multiline
        />

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          className={`h-14 justify-center items-center rounded-xl ${
            submitting ? "bg-yellow-700" : "bg-yellow-500"
          }`}
        >
          {submitting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text className="font-psemibold text-black text-base">
              Add driver
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}