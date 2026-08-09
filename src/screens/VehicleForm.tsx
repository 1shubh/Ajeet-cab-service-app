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
  fetchVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  setVehicleActive,
  clearCurrentVehicle,
  clearVehicleSubmitState,
  validateVehicle,
  VehicleInput,
  FuelType,
} from "@/redux/slice/vehicleSlice";
import { useAlert, AlertButton } from "@/components/AlertProvider";

const FUEL_TYPES: FuelType[] = ["diesel", "petrol", "cng", "electric"];

const EMPTY: VehicleInput = {
  bus_number: "",
  make: "",
  model: "",
  year: null,
  capacity: null,
  fuel_type: null,
  odometer: null,
  notes: "",
  insurance_number: "",
  insurance_expiry: "",
  fitness_expiry: "",
  permit_expiry: "",
  puc_expiry: "",
  last_service_date: "",
  next_service_date: "",
  image_uri: null,
  image_base64: null,
};

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
  autoCapitalize = "words",
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  error?: string;
  keyboardType?: "default" | "numeric";
  maxLength?: number;
  prefix?: string;
  multiline?: boolean;
  changed?: boolean;
  hint?: string;
  autoCapitalize?: "none" | "words" | "characters";
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
        error
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
        autoCapitalize={autoCapitalize}
      />
    </View>
    {error ? (
      <Text className="text-red-400 text-xs mt-1 ml-1">{error}</Text>
    ) : hint ? (
      <Text className="text-gray-600 text-xs mt-1 ml-1">{hint}</Text>
    ) : null}
  </View>
);

// Expiry field that shows how urgent the date is
const ExpiryField = ({
  label,
  value,
  onChangeText,
  error,
  changed,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  error?: string;
  changed?: boolean;
}) => {
  let status: { text: string; color: string } | null = null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const days = Math.ceil(
      (new Date(value).getTime() - Date.now()) / 86400000
    );
    if (days < 0) status = { text: "Expired", color: "text-red-400" };
    else if (days <= 30)
      status = { text: `${days} days left`, color: "text-red-400" };
    else if (days <= 90)
      status = { text: `${days} days left`, color: "text-yellow-400" };
    else status = { text: "Valid", color: "text-green-400" };
  }

  return (
    <View className="mb-4">
      <View className="flex-row items-center gap-2 mb-1.5 ml-1">
        <Text className="text-white font-pregular text-sm">{label}</Text>
        {changed && (
          <View className="bg-[#2a2412] px-2 py-0.5 rounded-full">
            <Text className="text-yellow-400 text-xs">edited</Text>
          </View>
        )}
        {status && (
          <Text className={`text-xs ${status.color}`}>· {status.text}</Text>
        )}
      </View>
      <View
        className={`border-2 rounded-xl px-3 ${
          error
            ? "border-red-500"
            : changed
              ? "border-yellow-400"
              : "border-[#665524]"
        }`}
      >
        <TextInput
          className="text-white font-pmedium"
          style={{ height: 48 }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#6b6b6b"
          value={value}
          onChangeText={onChangeText}
          keyboardType="numbers-and-punctuation"
        />
      </View>
      {error ? (
        <Text className="text-red-400 text-xs mt-1 ml-1">{error}</Text>
      ) : null}
    </View>
  );
};

// ============================================================
export default function VehicleForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { alert, confirm, toast } = useAlert();

  const { current, currentLoading, submitting, submitError } = useSelector(
    (s: RootState) => s.vehicles
  );
  const { profile } = useSelector((s: RootState) => s.profile);

  const [form, setForm] = useState<VehicleInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (isEdit) dispatch(fetchVehicleById(id!));
    return () => {
      dispatch(clearVehicleSubmitState());
      dispatch(clearCurrentVehicle());
    };
  }, [id]);

  // Seed in edit mode. image_base64 stays null — an https:// URI
  // with no base64 is how the thunk knows the image is unchanged.
  useEffect(() => {
    if (isEdit && current && current.id === id) {
      setForm({
        bus_number: current.bus_number,
        make: current.make ?? "",
        model: current.model ?? "",
        year: current.year,
        capacity: current.capacity,
        fuel_type: current.fuel_type,
        odometer: current.odometer,
        notes: current.notes ?? "",
        insurance_number: current.insurance_number ?? "",
        insurance_expiry: current.insurance_expiry ?? "",
        fitness_expiry: current.fitness_expiry ?? "",
        permit_expiry: current.permit_expiry ?? "",
        puc_expiry: current.puc_expiry ?? "",
        last_service_date: current.last_service_date ?? "",
        next_service_date: current.next_service_date ?? "",
        image_uri: current.image,
        image_base64: null,
      });
      setErrors({});
    }
  }, [current?.id]);

  useEffect(() => {
    if (submitError) {
      alert("Couldn't save", submitError, undefined, { tone: "danger" });
      dispatch(clearVehicleSubmitState());
    }
  }, [submitError]);

  const set = (key: keyof VehicleInput, value: any) => {
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
  const changes = useMemo(() => {
    if (!isEdit || !current) return form as Partial<VehicleInput>;

    const diff: Partial<VehicleInput> = {};
    const compare: [keyof VehicleInput, any][] = [
      ["bus_number", current.bus_number],
      ["make", current.make ?? ""],
      ["model", current.model ?? ""],
      ["year", current.year],
      ["capacity", current.capacity],
      ["fuel_type", current.fuel_type],
      ["odometer", current.odometer],
      ["notes", current.notes ?? ""],
      ["insurance_number", current.insurance_number ?? ""],
      ["insurance_expiry", current.insurance_expiry ?? ""],
      ["fitness_expiry", current.fitness_expiry ?? ""],
      ["permit_expiry", current.permit_expiry ?? ""],
      ["puc_expiry", current.puc_expiry ?? ""],
      ["last_service_date", current.last_service_date ?? ""],
      ["next_service_date", current.next_service_date ?? ""],
    ];

    for (const [key, original] of compare) {
      if (form[key] !== undefined && form[key] !== original) {
        (diff as any)[key] = form[key];
      }
    }

    if (form.image_uri !== current.image) {
      diff.image_uri = form.image_uri;
      diff.image_base64 = form.image_base64 ?? null;
    }

    return diff;
  }, [form, current, isEdit]);

  const changedKeys = new Set(Object.keys(changes));
  const isDirty = isEdit
    ? Object.keys(changes).length > 0
    : form.bus_number.trim() !== "" || !!form.image_uri;

  const changeCount = Object.keys(changes).filter(
    (k) => k !== "image_base64"
  ).length;

  // ----------------------------------------------------------
  const pickImage = async (source: "camera" | "gallery") => {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      alert(
        "Permission needed",
        `Allow ${source === "camera" ? "camera" : "photo library"} access to add a vehicle photo.`,
        undefined,
        { tone: "warning" }
      );
      return;
    }

    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9], // buses read better wide than square
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
      image_uri: asset.uri,
      image_base64: asset.base64 ?? null,
    }));
  };

  const chooseImage = () => {
    const options: AlertButton[] = [
      { text: "Take photo", onPress: () => pickImage("camera") },
      { text: "Choose from gallery", onPress: () => pickImage("gallery") },
    ];

    if (form.image_uri) {
      options.push({
        text: "Remove photo",
        style: "destructive",
        onPress: () =>
          setForm((p) => ({ ...p, image_uri: null, image_base64: null })),
      });
    }

    options.push({ text: "Cancel", style: "cancel" });
    alert("Vehicle photo", "Choose a source", options);
  };

  // ----------------------------------------------------------
  const handleSubmit = async () => {
    const v = validateVehicle(
      isEdit ? changes : { ...form, bus_number: form.bus_number ?? "" }
    );

    if (Object.keys(v).length > 0) {
      setErrors(v);
      toast("Check the highlighted fields", "warning");
      return;
    }

    if (isEdit) {
      if (!isDirty) {
        router.back();
        return;
      }
      const result = await dispatch(updateVehicle({ id: id!, changes }));
      if (updateVehicle.fulfilled.match(result)) {
        toast(`${result.payload.bus_number} updated`);
        router.back();
      }
    } else {
      const result = await dispatch(createVehicle(form));
      if (createVehicle.fulfilled.match(result)) {
        alert(
          "Vehicle added",
          `${result.payload.bus_number} is now in the fleet and can be assigned to a driver.`,
          [
            {
              text: "Add another",
              style: "cancel",
              onPress: () => setForm(EMPTY),
            },
            { text: "Done", onPress: () => router.back() },
          ],
          { tone: "success", dismissable: false }
        );
      }
    }
  };

  const handleBack = async () => {
    if (!isDirty) {
      router.back();
      return;
    }
    const discard = await confirm({
      title: isEdit ? "Discard changes?" : "Discard vehicle?",
      message: "Your edits haven't been saved.",
      confirmText: "Discard",
      cancelText: "Keep editing",
      tone: "danger",
    });
    if (discard) router.back();
  };

  const handleRetire = async () => {
    if (!current) return;
    const retiring = current.is_active;

    const ok = await confirm({
      title: retiring ? "Retire this vehicle?" : "Return to service?",
      message: retiring
        ? "It stays in records but can't be assigned to a driver."
        : "It becomes assignable again.",
      confirmText: retiring ? "Retire" : "Restore",
      tone: retiring ? "danger" : "info",
    });

    if (!ok) return;

    const result = await dispatch(
      setVehicleActive({ id: id!, is_active: !current.is_active })
    );
    if (setVehicleActive.fulfilled.match(result)) {
      dispatch(fetchVehicleById(id!));
      toast(retiring ? "Vehicle retired" : "Vehicle restored");
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete permanently?",
      message:
        "This removes the vehicle and its history entirely. Retiring keeps the record instead.",
      confirmText: "Delete",
      tone: "danger",
    });

    if (!ok) return;

    const result = await dispatch(deleteVehicle(id!));
    if (deleteVehicle.fulfilled.match(result)) {
      toast("Vehicle deleted");
      router.replace("/(admin)/vehicles");
    }
  };

  // ----------------------------------------------------------
  if (!isAdmin) {
    return (
      <View className="flex-1 bg-appBg items-center justify-center px-8">
        <Text className="text-gray-300 font-pmedium mb-2">Can't edit this</Text>
        <Text className="text-gray-600 text-xs text-center mb-6">
          Only admins can manage vehicles.
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

  if (isEdit && (currentLoading || !current)) {
    return (
      <View className="flex-1 bg-appBg items-center justify-center">
        <ActivityIndicator color="#FACC15" size="large" />
      </View>
    );
  }

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
              {isEdit ? current?.bus_number : "Add vehicle"}
            </Text>
            <Text className="text-gray-500 text-xs">
              {isEdit
                ? isDirty
                  ? `${changeCount} change${changeCount === 1 ? "" : "s"}`
                  : "No changes yet"
                : "Registration number is required"}
            </Text>
          </View>
        </View>

        {/* Image */}
        <TouchableOpacity
          onPress={chooseImage}
          className={`h-40 rounded-xl border-2 border-dashed overflow-hidden items-center justify-center bg-darkinputbg mb-2 ${
            changedKeys.has("image_uri")
              ? "border-yellow-400"
              : "border-[#665524]"
          }`}
        >
          {form.image_uri ? (
            <Image
              source={{ uri: form.image_uri }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <>
              <Ionicons name="bus-outline" size={36} color="#665524" />
              <Text className="text-gray-500 text-xs mt-2">
                Tap to add a photo
              </Text>
              <Text className="text-gray-600 text-xs mt-0.5">Optional</Text>
            </>
          )}
        </TouchableOpacity>
        {form.image_uri && (
          <Text className="text-gray-500 text-xs text-center mb-4">
            Tap to change or remove
          </Text>
        )}

        {/* Identity */}
        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3 mt-2">
          Identity
        </Text>

        <Field
          label="Registration number"
          value={form.bus_number}
          onChangeText={(t) => set("bus_number", t.toUpperCase())}
          placeholder="MH12AB1234"
          error={errors.bus_number}
          changed={changedKeys.has("bus_number")}
          autoCapitalize="characters"
          maxLength={15}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field
              label="Make"
              value={form.make ?? ""}
              onChangeText={(t) => set("make", t)}
              placeholder="Tata"
              changed={changedKeys.has("make")}
            />
          </View>
          <View className="flex-1">
            <Field
              label="Model"
              value={form.model ?? ""}
              onChangeText={(t) => set("model", t)}
              placeholder="Starbus"
              changed={changedKeys.has("model")}
            />
          </View>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field
              label="Year"
              value={form.year ? String(form.year) : ""}
              onChangeText={(t) =>
                set("year", Number(t.replace(/[^0-9]/g, "")) || null)
              }
              placeholder="2020"
              keyboardType="numeric"
              maxLength={4}
              error={errors.year}
              changed={changedKeys.has("year")}
            />
          </View>
          <View className="flex-1">
            <Field
              label="Seats"
              value={form.capacity ? String(form.capacity) : ""}
              onChangeText={(t) =>
                set("capacity", Number(t.replace(/[^0-9]/g, "")) || null)
              }
              placeholder="32"
              keyboardType="numeric"
              maxLength={3}
              error={errors.capacity}
              changed={changedKeys.has("capacity")}
            />
          </View>
        </View>

        <View className="flex-row items-center gap-2 mb-1.5 ml-1">
          <Text className="text-white font-pregular text-sm">Fuel</Text>
          {changedKeys.has("fuel_type") && (
            <View className="bg-[#2a2412] px-2 py-0.5 rounded-full">
              <Text className="text-yellow-400 text-xs">edited</Text>
            </View>
          )}
        </View>
        <View className="flex-row gap-2 mb-4">
          {FUEL_TYPES.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => set("fuel_type", form.fuel_type === f ? null : f)}
              className={`flex-1 h-10 rounded-lg border items-center justify-center ${
                form.fuel_type === f
                  ? "border-yellow-400 bg-[#2a2412]"
                  : "border-gray-700 bg-darkinputbg"
              }`}
            >
              <Text
                className={`text-xs font-pmedium capitalize ${
                  form.fuel_type === f ? "text-yellow-400" : "text-gray-400"
                }`}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Documents */}
        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3 mt-2">
          Documents
        </Text>
        <Text className="text-gray-600 text-xs mb-3 ml-1">
          Expiry dates drive the alerts on your dashboard.
        </Text>

        <Field
          label="Insurance number"
          value={form.insurance_number ?? ""}
          onChangeText={(t) => set("insurance_number", t.toUpperCase())}
          placeholder="POL-123456789"
          changed={changedKeys.has("insurance_number")}
          autoCapitalize="characters"
        />

        <ExpiryField
          label="Insurance expiry"
          value={form.insurance_expiry ?? ""}
          onChangeText={(t) => set("insurance_expiry", t)}
          error={errors.insurance_expiry}
          changed={changedKeys.has("insurance_expiry")}
        />
        <ExpiryField
          label="Fitness certificate expiry"
          value={form.fitness_expiry ?? ""}
          onChangeText={(t) => set("fitness_expiry", t)}
          error={errors.fitness_expiry}
          changed={changedKeys.has("fitness_expiry")}
        />
        <ExpiryField
          label="Permit expiry"
          value={form.permit_expiry ?? ""}
          onChangeText={(t) => set("permit_expiry", t)}
          error={errors.permit_expiry}
          changed={changedKeys.has("permit_expiry")}
        />
        <ExpiryField
          label="PUC expiry"
          value={form.puc_expiry ?? ""}
          onChangeText={(t) => set("puc_expiry", t)}
          error={errors.puc_expiry}
          changed={changedKeys.has("puc_expiry")}
        />

        {/* Service */}
        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3 mt-2">
          Service
        </Text>

        <Field
          label="Odometer"
          value={form.odometer ? String(form.odometer) : ""}
          onChangeText={(t) =>
            set("odometer", Number(t.replace(/[^0-9]/g, "")) || null)
          }
          placeholder="85000"
          keyboardType="numeric"
          error={errors.odometer}
          changed={changedKeys.has("odometer")}
          hint="Kilometres on the clock"
        />

        <ExpiryField
          label="Last serviced"
          value={form.last_service_date ?? ""}
          onChangeText={(t) => set("last_service_date", t)}
          error={errors.last_service_date}
          changed={changedKeys.has("last_service_date")}
        />
        <ExpiryField
          label="Next service due"
          value={form.next_service_date ?? ""}
          onChangeText={(t) => set("next_service_date", t)}
          error={errors.next_service_date}
          changed={changedKeys.has("next_service_date")}
        />

        <Field
          label="Notes"
          value={form.notes ?? ""}
          onChangeText={(t) => set("notes", t)}
          placeholder="AC not working in rear section"
          multiline
          changed={changedKeys.has("notes")}
        />

        {/* Assignment info in edit mode */}
        {isEdit && current?.assigned_driver_name && (
          <View className="border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-4">
            <Text className="text-gray-500 text-xs mb-1">
              Currently assigned
            </Text>
            <Text className="text-white font-pmedium text-sm">
              {current.assigned_driver_name}
              {current.assigned_route_name
                ? ` · ${current.assigned_route_name}`
                : ""}
            </Text>
            <Text className="text-gray-600 text-xs mt-1">
              Change this from the driver's profile.
            </Text>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting || (isEdit && !isDirty)}
          className={`h-14 justify-center items-center rounded-xl ${
            submitting
              ? "bg-yellow-700"
              : isEdit && !isDirty
                ? "bg-gray-800"
                : "bg-yellow-500"
          }`}
        >
          {submitting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text
              className={`font-psemibold text-base ${
                isEdit && !isDirty ? "text-gray-500" : "text-black"
              }`}
            >
              {isEdit
                ? isDirty
                  ? "Save changes"
                  : "No changes"
                : "Add vehicle"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Danger zone */}
        {isEdit && current && (
          <>
            <TouchableOpacity
              onPress={handleRetire}
              className={`h-12 justify-center items-center rounded-xl mt-6 border ${
                current.is_active
                  ? "border-gray-700 bg-darkinputbg"
                  : "border-green-900 bg-green-950"
              }`}
            >
              <Text
                className={`font-pmedium text-sm ${
                  current.is_active ? "text-gray-300" : "text-green-300"
                }`}
              >
                {current.is_active ? "Retire vehicle" : "Return to service"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDelete}
              className="h-12 justify-center items-center rounded-xl mt-2 border border-red-900 bg-red-950"
            >
              <Text className="text-red-300 font-pmedium text-sm">
                Delete permanently
              </Text>
            </TouchableOpacity>

            <Text className="text-gray-600 text-xs text-center mt-3">
              Retiring keeps the record. Deleting removes it entirely.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}