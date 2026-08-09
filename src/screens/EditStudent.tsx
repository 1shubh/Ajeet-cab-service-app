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
  fetchStudentById,
  updateStudent,
  clearSubmitState,
  clearCurrent,
  AdmissionInput,
} from "@/redux/slice/admissionslice";
import { fetchRoutes } from "@/redux/slice/routeslice";
import { useAlert, AlertButton } from "@/components/AlertProvider";

// ============================================================
// Reusable field
// ============================================================
const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = "default",
  multiline = false,
  maxLength,
  prefix,
  changed,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  error?: string;
  keyboardType?: "default" | "phone-pad" | "numeric";
  multiline?: boolean;
  maxLength?: number;
  prefix?: string;
  changed?: boolean;
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
            ? { height: 80, textAlignVertical: "top", paddingTop: 10 }
            : { height: 48 }
        }
        placeholder={placeholder}
        placeholderTextColor="#6b6b6b"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
      />
    </View>
    {error ? (
      <Text className="text-red-400 text-xs mt-1 ml-1">{error}</Text>
    ) : null}
  </View>
);

// ============================================================
// Screen
// ============================================================
export default function EditStudent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { alert, toast, confirm } = useAlert();

  const {
    current,
    currentLoading,
    currentError,
    submitting,
    submitError,
    uploadProgress,
  } = useSelector((s: RootState) => s.admissions);
  const { profile } = useSelector((s: RootState) => s.profile);
  const { routes } = useSelector((s: RootState) => s.routes);

  const [form, setForm] = useState<Partial<AdmissionInput>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    dispatch(fetchStudentById(id));
    dispatch(fetchRoutes());
    return () => {
      dispatch(clearSubmitState());
      dispatch(clearCurrent());
    };
  }, [id]);

  // Seed the form once the student loads.
  // student_photo_base64 stays undefined here — an https:// URI
  // with no base64 is how the thunk recognises "photo unchanged".
  useEffect(() => {
    if (current && current.id === id) {
      setForm({
        student_name: current.student_name,
        student_photo_uri: current.student_photo,
        student_photo_base64: null,
        school_name: current.school_name,
        address: current.address,
        class_name: current.class_name ?? "",
        parent_name: current.parent_name,
        parent_phone: current.parent_phone,
        route_id: current.route_id,
        pickup_stop: current.pickup_stop ?? "",
        monthly_fee: current.monthly_fee,
      });
      setErrors({});
    }
  }, [current?.id]);

  const canEdit =
    profile?.role === "admin" || current?.admitted_by === profile?.id;

  // ----------------------------------------------------------
  // Diff — only changed fields get sent, so two people editing
  // different fields on the same student don't clobber each other
  // ----------------------------------------------------------
  const changes = useMemo(() => {
    if (!current) return {} as Partial<AdmissionInput>;
    const diff: Partial<AdmissionInput> = {};

    const compare: [keyof AdmissionInput, any][] = [
      ["student_name", current.student_name],
      ["school_name", current.school_name],
      ["address", current.address],
      ["class_name", current.class_name ?? ""],
      ["parent_name", current.parent_name],
      ["parent_phone", current.parent_phone],
      ["route_id", current.route_id],
      ["pickup_stop", current.pickup_stop ?? ""],
      ["monthly_fee", current.monthly_fee],
    ];

    for (const [key, original] of compare) {
      if (form[key] !== undefined && form[key] !== original) {
        (diff as any)[key] = form[key];
      }
    }

    // Photo must carry its base64 through, otherwise the thunk
    // sees a file:// URI with no bytes and skips the upload
    if (form.student_photo_uri !== current.student_photo) {
      diff.student_photo_uri = form.student_photo_uri;
      diff.student_photo_base64 = form.student_photo_base64 ?? null;
    }

    return diff;
  }, [form, current]);

  const isDirty = Object.keys(changes).length > 0;
  const changedKeys = new Set(Object.keys(changes));
  const photoChanged = changedKeys.has("student_photo_uri");

  // Count photo as one change even though it sends two keys
  const changeCount = Object.keys(changes).filter(
    (k) => k !== "student_photo_base64",
  ).length;

  const set = (key: keyof AdmissionInput, value: any) => {
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
  // Photo picker — must capture base64, not just the URI
  // ----------------------------------------------------------
  const pickPhoto = async (source: "camera" | "gallery") => {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      alert(
        "Permission needed",
        "Allow camera access to change the photo.",
        undefined,
        {
          tone: "warning",
        },
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
        { tone: "danger" },
      );
      return;
    }

    // Single setForm — two sequential set() calls would race and
    // the second would overwrite the first's state snapshot
    setForm((p) => ({
      ...p,
      student_photo_uri: asset.uri,
      student_photo_base64: asset.base64 ?? null,
    }));
  };

  // const choosePhoto = () => {
  //   const options: any[] = [
  //     { text: "Take photo", onPress: () => pickPhoto("camera") },
  //     { text: "Choose from gallery", onPress: () => pickPhoto("gallery") },
  //   ];

  //   if (form.student_photo_uri) {
  //     options.push({
  //       text: "Remove photo",
  //       style: "destructive",
  //       onPress: () =>
  //         setForm((p) => ({
  //           ...p,
  //           student_photo_uri: null,
  //           student_photo_base64: null,
  //         })),
  //     });
  //   }
  //   options.push({ text: "Cancel", style: "cancel" });
  //   alert("Student photo", "Choose a source", options);
  // };
  const choosePhoto = () => {
    const options: AlertButton[] = [
      { text: "Take photo", onPress: () => pickPhoto("camera") },
      { text: "Choose from gallery", onPress: () => pickPhoto("gallery") },
    ];

    if (form.student_photo_uri) {
      options.push({
        text: "Remove photo",
        style: "destructive",
        onPress: () =>
          setForm((p) => ({
            ...p,
            student_photo_uri: null,
            student_photo_base64: null,
          })),
      });
    }

    options.push({ text: "Cancel", style: "cancel" });

    alert("Student photo", "Choose a source", options);
  };
  // ----------------------------------------------------------
  const handleSave = async () => {
    if (!isDirty) {
      router.back();
      return;
    }

    const result = await dispatch(updateStudent({ id, changes }));

    if (updateStudent.fulfilled.match(result)) {
      toast(`${result.payload.student_name} updated`);
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

  // ----------------------------------------------------------
  // Loading / error / permission states
  // ----------------------------------------------------------
  if (currentLoading || !current) {
    return (
      <View className="flex-1 bg-appBg items-center justify-center px-8">
        {currentError ? (
          <>
            <Text className="text-gray-400 font-pmedium mb-2">
              Couldn't load student
            </Text>
            <Text className="text-gray-600 text-xs mb-6 text-center">
              {currentError}
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              className="border border-yellow-400 px-6 h-11 rounded-xl justify-center"
            >
              <Text className="text-yellow-400 font-pmedium text-xs">
                Go back
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator color="#FACC15" size="large" />
        )}
      </View>
    );
  }

  if (!canEdit) {
    return (
      <View className="flex-1 bg-appBg items-center justify-center px-8">
        <Text className="text-gray-300 font-pmedium mb-2">Can't edit this</Text>
        <Text className="text-gray-600 text-xs text-center mb-6">
          Only an admin or the person who admitted this student can make
          changes.
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

  const initials = (form.student_name ?? "")
    .trim()
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
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
            <Text
              className="text-white font-psemibold text-lg"
              numberOfLines={1}
            >
              Edit student
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
            {form.student_photo_uri ? (
              <Image
                source={{ uri: form.student_photo_uri }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : initials ? (
              <Text className="text-yellow-400 font-psemibold text-3xl">
                {initials}
              </Text>
            ) : (
              <Text className="text-gray-500 text-xs text-center px-2">
                Tap to add{"\n"}photo
              </Text>
            )}
          </TouchableOpacity>
          <Text className="text-gray-500 text-xs mt-2">
            {photoChanged ? "New photo selected" : "Tap to change"}
          </Text>
        </View>

        {/* Student details */}
        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3">
          Student details
        </Text>

        <Field
          label="Student name"
          value={form.student_name ?? ""}
          onChangeText={(t) => set("student_name", t)}
          placeholder="Aarav Sharma"
          error={errors.student_name}
          changed={changedKeys.has("student_name")}
        />
        <Field
          label="School name"
          value={form.school_name ?? ""}
          onChangeText={(t) => set("school_name", t)}
          placeholder="Delhi Public School"
          error={errors.school_name}
          changed={changedKeys.has("school_name")}
        />
        <Field
          label="Class"
          value={form.class_name ?? ""}
          onChangeText={(t) => set("class_name", t)}
          placeholder="5th B"
          changed={changedKeys.has("class_name")}
        />
        <Field
          label="Pickup address"
          value={form.address ?? ""}
          onChangeText={(t) => set("address", t)}
          placeholder="Flat 302, Green Residency"
          error={errors.address}
          multiline
          changed={changedKeys.has("address")}
        />

        {/* Parent */}
        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3 mt-2">
          Parent / guardian
        </Text>

        <Field
          label="Parent name"
          value={form.parent_name ?? ""}
          onChangeText={(t) => set("parent_name", t)}
          placeholder="Rajesh Sharma"
          error={errors.parent_name}
          changed={changedKeys.has("parent_name")}
        />
        <Field
          label="Mobile number"
          value={form.parent_phone ?? ""}
          onChangeText={(t) => set("parent_phone", t.replace(/[^0-9]/g, ""))}
          placeholder="9876543210"
          error={errors.parent_phone}
          keyboardType="phone-pad"
          maxLength={10}
          prefix="+91"
          changed={changedKeys.has("parent_phone")}
        />

        {/* Transport */}
        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3 mt-2">
          Transport
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

        {current.status === "pending" && form.route_id && (
          <View className="border border-green-900 bg-green-950 rounded-xl p-3 mb-4">
            <Text className="text-green-300 text-xs">
              Saving will activate this student.
            </Text>
          </View>
        )}

        <Field
          label="Pickup stop"
          value={form.pickup_stop ?? ""}
          onChangeText={(t) => set("pickup_stop", t)}
          placeholder="Green Residency Gate"
          changed={changedKeys.has("pickup_stop")}
        />
        <Field
          label="Monthly fee"
          value={form.monthly_fee ? String(form.monthly_fee) : ""}
          onChangeText={(t) =>
            set("monthly_fee", Number(t.replace(/[^0-9]/g, "")) || 0)
          }
          placeholder="1500"
          keyboardType="numeric"
          prefix="₹"
          changed={changedKeys.has("monthly_fee")}
        />

        {/* Server error */}
        {submitError && (
          <View className="border border-red-900 bg-red-950 rounded-xl p-3 mb-4">
            <Text className="text-red-300 text-xs font-pmedium">
              {submitError}
            </Text>
          </View>
        )}

        {/* Upload progress */}
        {submitting && uploadProgress > 0 && (
          <View className="mb-4">
            <View className="bg-gray-800 rounded-full h-1.5">
              <View
                className="bg-yellow-400 rounded-full h-1.5"
                style={{ width: `${uploadProgress}%` }}
              />
            </View>
            <Text className="text-gray-500 text-xs mt-1.5 text-center">
              {uploadProgress < 80 ? "Uploading photo…" : "Saving changes…"}
            </Text>
          </View>
        )}

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={submitting || !isDirty}
          className={`h-14 justify-center items-center rounded-xl ${
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
