import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import React, { useEffect, useState, useMemo } from "react";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppDispatch, RootState } from "@/redux/store";
import {
  fetchDriverById,
  updateDriver,
  deleteDriver,
  fetchVehicles,
  clearCurrentDriver,
  clearDriverSubmitState,
  DriverInput,
} from "@/redux/slice/driverSlice";
import { fetchRoutes } from "@/redux/slice/routeslice";
import { useAlert, AlertButton } from "@/components/AlertProvider";

// ============================================================
const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = "default",
  maxLength,
  prefix,
  multiline = false,
  changed,
  hint,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  error?: string;
  keyboardType?: "default" | "phone-pad" | "numeric";
  maxLength?: number;
  prefix?: string;
  multiline?: boolean;
  changed?: boolean;
  hint?: string;
  editable?: boolean;
}) => (
  <View className="mb-4">
    <View className="flex-row items-center gap-2 mb-1.5 ml-1">
      <Text className="text-white font-pregular text-sm">{label}</Text>
      {changed && (
        <View className="bg-[#2a2412] px-2 py-0.5 rounded-full">
          <Text className="text-yellow-400 text-xs">edited</Text>
        </View>
      )}
    </View>
    <View
      className={`border-2 rounded-xl flex-row items-center px-3 ${
        !editable
          ? "border-gray-800 bg-gray-900/40"
          : error
            ? "border-red-500"
            : changed
              ? "border-yellow-400"
              : "border-[#665524]"
      }`}
    >
      {prefix && (
        <Text className="text-gray-400 font-pmedium mr-1">{prefix}</Text>
      )}
      <TextInput
        className={`flex-1 font-pmedium ${editable ? "text-white" : "text-gray-500"}`}
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
        editable={editable}
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

// ============================================================
export default function EditDriver() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { alert, confirm, toast } = useAlert();

  const {
    current: driver,
    currentLoading,
    submitting,
    submitError,
    vehicles,
  } = useSelector((s: RootState) => s.drivers);
  const { routes } = useSelector((s: RootState) => s.routes);
  const { profile } = useSelector((s: RootState) => s.profile);

  const [form, setForm] = useState<Partial<DriverInput>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    dispatch(fetchDriverById(id));
    dispatch(fetchRoutes());
    dispatch(fetchVehicles());
    return () => {
      dispatch(clearDriverSubmitState());
      dispatch(clearCurrentDriver());
    };
  }, [id]);

  // Seed once the driver loads. profile_photo_base64 stays null —
  // an https:// URI with no base64 is how the thunk recognises
  // "photo unchanged" and skips the upload.
  useEffect(() => {
    if (driver && driver.driver_id === id) {
      setForm({
        name: driver.name,
        phone: driver.phone ?? "",
        profile_photo_uri: driver.profile_image,
        profile_photo_base64: null,
        license_number: driver.license_number ?? "",
        license_expiry: driver.license_expiry ?? "",
        monthly_salary: driver.monthly_salary,
        address: (driver as any).address ?? "",
        emergency_contact: (driver as any).emergency_contact ?? "",
        route_id: driver.route_id,
        vehicle_id: driver.vehicle_id,
        notes: (driver as any).notes ?? "",
      });
      setErrors({});
    }
  }, [driver?.driver_id]);

  useEffect(() => {
    if (submitError) {
      alert("Couldn't save", submitError, undefined, { tone: "danger" });
      dispatch(clearDriverSubmitState());
    }
  }, [submitError]);

  // ----------------------------------------------------------
  // Diff — only changed fields are sent
  // ----------------------------------------------------------
  const changes = useMemo(() => {
    if (!driver) return {} as Partial<DriverInput>;
    const diff: Partial<DriverInput> = {};

    const compare: [keyof DriverInput, any][] = [
      ["name", driver.name],
      ["phone", driver.phone ?? ""],
      ["license_number", driver.license_number ?? ""],
      ["license_expiry", driver.license_expiry ?? ""],
      ["monthly_salary", driver.monthly_salary],
      ["address", (driver as any).address ?? ""],
      ["emergency_contact", (driver as any).emergency_contact ?? ""],
      ["route_id", driver.route_id],
      ["vehicle_id", driver.vehicle_id],
      ["notes", (driver as any).notes ?? ""],
    ];

    for (const [key, original] of compare) {
      if (form[key] !== undefined && form[key] !== original) {
        (diff as any)[key] = form[key];
      }
    }

    // Photo carries its base64 through, or the upload is skipped
    if (form.profile_photo_uri !== driver.profile_image) {
      diff.profile_photo_uri = form.profile_photo_uri;
      diff.profile_photo_base64 = form.profile_photo_base64 ?? null;
    }

    return diff;
  }, [form, driver]);

  const isDirty = Object.keys(changes).length > 0;
  const changedKeys = new Set(Object.keys(changes));
  const photoChanged = changedKeys.has("profile_photo_uri");

  // Photo sends two keys but is one visible change
  const changeCount = Object.keys(changes).filter(
    (k) => k !== "profile_photo_base64"
  ).length;

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

  // ----------------------------------------------------------
  const pickPhoto = async (source: "camera" | "gallery") => {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      alert(
        "Permission needed",
        `Allow ${source === "camera" ? "camera" : "photo library"} access to change the photo.`,
        undefined,
        { tone: "warning" }
      );
      return;
    }

    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    };

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];

    if (!asset.base64) {
      alert(
        "Couldn't read the image",
        "Try picking it again, or choose a different photo.",
        undefined,
        { tone: "danger" }
      );
      return;
    }

    setForm((p) => ({
      ...p,
      profile_photo_uri: asset.uri,
      profile_photo_base64: asset.base64 ?? null,
    }));
  };

  const choosePhoto = () => {
    const options: AlertButton[] = [
      { text: "Take photo", onPress: () => pickPhoto("camera") },
      { text: "Choose from gallery", onPress: () => pickPhoto("gallery") },
    ];

    if (form.profile_photo_uri) {
      options.push({
        text: "Remove photo",
        style: "destructive",
        onPress: () =>
          setForm((p) => ({
            ...p,
            profile_photo_uri: null,
            profile_photo_base64: null,
          })),
      });
    }

    options.push({ text: "Cancel", style: "cancel" });
    alert("Profile photo", "Choose a source", options);
  };

  // ----------------------------------------------------------
  const handleSave = async () => {
    if (!isDirty) {
      router.back();
      return;
    }

    if (changes.name !== undefined && changes.name.trim().length < 2) {
      setErrors({ name: "Enter the driver's full name" });
      toast("Check the highlighted fields", "warning");
      return;
    }

    if (
      changes.phone !== undefined &&
      changes.phone.trim() &&
      !/^[0-9]{10}$/.test(changes.phone.trim())
    ) {
      setErrors({ phone: "Enter a valid 10-digit mobile number" });
      toast("Check the highlighted fields", "warning");
      return;
    }
    const result = await dispatch(updateDriver({ driverId: id, changes }));
    if (updateDriver.fulfilled.match(result)) {
      toast(`${result.payload.name} updated`);
      router.back();
    }
  };

  const handleBack = async () => {
    if (!isDirty) {
      router.back();
      return;
    }
    const discard = await confirm({
      title: "Discard changes?",
      message: "Your edits haven't been saved.",
      confirmText: "Discard",
      cancelText: "Keep editing",
      tone: "danger",
    });
    if (discard) router.back();
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Remove this driver?",
      message:
        "This permanently deletes the record. If they have salary history or admitted students, deactivate them instead.",
      confirmText: "Remove",
      tone: "danger",
    });

    if (!ok) return;

    const result = await dispatch(deleteDriver(id));

    if (deleteDriver.fulfilled.match(result)) {
      toast("Driver removed");
      router.replace("/(admin)/drivers");
    }
    // Rejection carries the "has N payments, deactivate instead"
    // message and surfaces through the submitError effect
  };

  // ----------------------------------------------------------
  if (currentLoading || !driver) {
    return (
      <View className="flex-1 bg-appBg items-center justify-center">
        <ActivityIndicator color="#FACC15" size="large" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View className="flex-1 bg-appBg items-center justify-center px-8">
        <Text className="text-gray-300 font-pmedium mb-2">Can't edit this</Text>
        <Text className="text-gray-600 text-xs text-center mb-6">
          Only admins can change driver details.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="border border-yellow-400 px-6 h-11 rounded-xl justify-center"
        >
          <Text className="text-yellow-400 font-pmedium text-xs">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = (form.name ?? "")
    .trim()
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const freeVehicles = vehicles.filter(
    (v) => !v.assigned_driver_id || v.id === driver.vehicle_id
  );

  const loginPhone = (driver as any).login_phone as string | undefined;

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
        {/* Header */}
        <View className="flex-row items-center gap-3 mb-6">
          <TouchableOpacity
            onPress={handleBack}
            className="w-10 h-10 rounded-full border border-[#665524] items-center justify-center"
          >
            <Ionicons name="arrow-back" size={16} color="#FACC15" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white font-psemibold text-lg" numberOfLines={1}>
              Edit driver
            </Text>
            <Text className="text-gray-500 text-xs">
              {isDirty
                ? `${changeCount} change${changeCount === 1 ? "" : "s"}`
                : "No changes yet"}
            </Text>
          </View>
        </View>

        {/* Photo */}
        <View className="items-center mb-6">
          <TouchableOpacity
            onPress={choosePhoto}
            className={`w-28 h-28 rounded-full border-2 overflow-hidden items-center justify-center bg-darkinputbg ${
              photoChanged ? "border-yellow-400" : "border-[#665524]"
            }`}
          >
            {form.profile_photo_uri ? (
              <Image
                source={{ uri: form.profile_photo_uri }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : initials ? (
              <Text className="text-yellow-400 font-psemibold text-3xl">
                {initials}
              </Text>
            ) : (
              <Ionicons name="person" size={36} color="#665524" />
            )}
          </TouchableOpacity>
          <Text className="text-gray-500 text-xs mt-2">
            {photoChanged ? "New photo selected" : "Tap to change"}
          </Text>
        </View>

        {/* Personal */}
        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3">
          Personal
        </Text>

        <Field
          label="Full name"
          value={form.name ?? ""}
          onChangeText={(t) => set("name", t)}
          placeholder="Suresh Kumar"
          error={errors.name}
          changed={changedKeys.has("name")}
        />

        {loginPhone && (
          <Field
            label="Login number"
            value={loginPhone.replace(/^91/, "")}
            onChangeText={() => {}}
            placeholder=""
            prefix="+91"
            editable={false}
            hint="This is their sign-in identity and can't be changed"
          />
        )}

        <Field
          label="Contact number"
          value={form.phone ?? ""}
          onChangeText={(t) => set("phone", t.replace(/[^0-9]/g, ""))}
          placeholder="9876543210"
          error={errors.phone}
          keyboardType="phone-pad"
          maxLength={10}
          prefix="+91"
          changed={changedKeys.has("phone")}
          hint="Used for the call button — can differ from the login number"
        />

        <Field
          label="Address"
          value={form.address ?? ""}
          onChangeText={(t) => set("address", t)}
          placeholder="House 12, Sector 9"
          multiline
          changed={changedKeys.has("address")}
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
          changed={changedKeys.has("emergency_contact")}
        />

        {/* License */}
        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3 mt-2">
          License
        </Text>

        <Field
          label="License number"
          value={form.license_number ?? ""}
          onChangeText={(t) => set("license_number", t.toUpperCase())}
          placeholder="DL-1420110012345"
          changed={changedKeys.has("license_number")}
        />

        <Field
          label="Expiry date"
          value={form.license_expiry ?? ""}
          onChangeText={(t) => set("license_expiry", t)}
          placeholder="YYYY-MM-DD"
          error={errors.license_expiry}
          changed={changedKeys.has("license_expiry")}
          hint="Alerts appear 30 days before this date"
        />

        {/* Salary */}
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
          changed={changedKeys.has("monthly_salary")}
        />

        {changedKeys.has("monthly_salary") && (
          <View className="border border-yellow-800 bg-yellow-950 rounded-xl p-3 mb-4">
            <Text className="text-yellow-300 text-xs">
              Changing salary recalculates the balance for every month,
              including ones already settled.
            </Text>
          </View>
        )}

        {/* Assignment */}
        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3 mt-2">
          Assignment
        </Text>

        <View className="flex-row items-center gap-2 mb-1.5 ml-1">
          <Text className="text-white font-pregular text-sm">Route</Text>
          {changedKeys.has("route_id") && (
            <View className="bg-[#2a2412] px-2 py-0.5 rounded-full">
              <Text className="text-yellow-400 text-xs">edited</Text>
            </View>
          )}
        </View>
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
              No route
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

        <View className="flex-row items-center gap-2 mb-1.5 ml-1">
          <Text className="text-white font-pregular text-sm">Vehicle</Text>
          {changedKeys.has("vehicle_id") && (
            <View className="bg-[#2a2412] px-2 py-0.5 rounded-full">
              <Text className="text-yellow-400 text-xs">edited</Text>
            </View>
          )}
        </View>
        {freeVehicles.length === 0 ? (
          <View className="border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-4">
            <Text className="text-gray-400 text-xs">
              {vehicles.length === 0
                ? "No vehicles added yet."
                : "Every vehicle is assigned to another driver."}
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
                No vehicle
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
          multiline
          changed={changedKeys.has("notes")}
        />

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={submitting || !isDirty}
          className={`h-14 justify-center items-center rounded-xl mb-3 ${
            submitting
              ? "bg-yellow-700"
              : isDirty
                ? "bg-yellow-500"
                : "bg-gray-800"
          }`}
        >
          {submitting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text
              className={`font-psemibold text-base ${
                isDirty ? "text-black" : "text-gray-500"
              }`}
            >
              {isDirty ? "Save changes" : "No changes"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Danger zone */}
        <TouchableOpacity
          onPress={handleDelete}
          disabled={submitting}
          className="h-12 justify-center items-center rounded-xl border border-red-900 bg-red-950"
        >
          <Text className="text-red-300 font-pmedium text-sm">
            Remove driver
          </Text>
        </TouchableOpacity>

        <Text className="text-gray-600 text-xs text-center mt-3">
          To keep salary history, deactivate from the profile screen instead.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}