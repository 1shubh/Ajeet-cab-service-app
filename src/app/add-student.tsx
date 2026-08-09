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
import React, { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppDispatch, RootState } from "@/redux/store";
import {
  AdmissionInput,
  clearSubmitState,
  createAdmission,
  validateNewAdmission,
} from "@/redux/slice/admissionslice";
import { fetchRoutes } from "@/redux/slice/routeslice";
import { useAlert, AlertButton } from "@/components/AlertProvider";


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
  required = true,
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
  required?: boolean;
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
        autoCapitalize={keyboardType === "phone-pad" ? "none" : "words"}
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
const EMPTY_FORM: AdmissionInput = {
  student_name: "",
  student_photo_uri: null,
  student_photo_base64: null,
  school_name: "",
  address: "",
  class_name: "",
  parent_name: "",
  parent_phone: "",
  route_id: null,
  pickup_stop: "",
  monthly_fee: 0,
};

const AddStudent = () => {
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { alert, confirm, toast } = useAlert();

  const { submitting, submitError, uploadProgress } = useSelector(
    (s: RootState) => s.admissions
  );
  const { profile } = useSelector((s: RootState) => s.profile);
  const { routes } = useSelector((s: RootState) => s.routes);

  const [form, setForm] = useState<AdmissionInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    dispatch(fetchRoutes());
    return () => {
      dispatch(clearSubmitState());
    };
  }, []);

  const set = (key: keyof AdmissionInput, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    }
  };

  // Anything typed counts as unsaved work worth warning about
  const isDirty =
    form.student_name.trim() !== "" ||
    form.school_name.trim() !== "" ||
    form.address.trim() !== "" ||
    form.parent_name.trim() !== "" ||
    form.parent_phone.trim() !== "" ||
    !!form.student_photo_uri;

  // ----------------------------------------------------------
  // Photo picker
  //
  // base64 must be captured here — the upload helper in the
  // thunk takes bytes, not a file path, so a URI alone silently
  // skips the upload.
  // ----------------------------------------------------------
  const pickPhoto = async (source: "camera" | "gallery") => {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      alert(
        "Permission needed",
        `Allow ${source === "camera" ? "camera" : "photo library"} access to add a student photo.`,
        undefined,
        { tone: "warning" }
      );
      return;
    }

    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6, // keeps uploads around 200–300 KB
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

    // One setForm — two sequential set() calls would race and the
    // second would overwrite the first's state snapshot
    setForm((p) => ({
      ...p,
      student_photo_uri: asset.uri,
      student_photo_base64: asset.base64 ?? null,
    }));
  };

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
  const resetForm = (keepContext = true) => {
    setForm({
      ...EMPTY_FORM,
      // These are usually identical for consecutive admissions
      school_name: keepContext ? form.school_name : "",
      route_id: keepContext ? form.route_id : null,
      monthly_fee: keepContext ? form.monthly_fee : 0,
    });
    setErrors({});
  };

  const handleSubmit = async () => {
    const validationErrors = validateNewAdmission(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast("Check the highlighted fields", "warning");
      return;
    }

    const result = await dispatch(createAdmission(form));

    if (createAdmission.fulfilled.match(result)) {
      alert(
        "Student admitted",
        `${result.payload.student_name} has been added${
          form.route_id ? "" : ". Assign a route to activate them."
        }`,
        [
          { text: "Add another", style: "cancel", onPress: () => resetForm() },
          { text: "Done", onPress: () => router.back() },
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
      title: "Discard admission?",
      message: "The details you've entered won't be saved.",
      confirmText: "Discard",
      cancelText: "Keep editing",
      tone: "danger",
    });

    if (discard) router.back();
  };

  const initials = form.student_name
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
            <Text className="text-white font-psemibold text-lg">
              New admission
            </Text>
            <Text className="text-gray-500 text-xs">
              Admitting as {profile?.role}
            </Text>
          </View>
        </View>

        {/* Photo */}
        <View className="items-center mb-6">
          <TouchableOpacity
            onPress={choosePhoto}
            className="w-28 h-28 rounded-full border-2 border-yellow-400 overflow-hidden items-center justify-center bg-darkinputbg"
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
            {form.student_photo_uri ? "Tap to change" : "Optional"}
          </Text>
        </View>

        {/* Student details */}
        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3">
          Student details
        </Text>

        <Field
          label="Student name"
          value={form.student_name}
          onChangeText={(t) => set("student_name", t)}
          placeholder="Aarav Sharma"
          error={errors.student_name}
        />
        <Field
          label="School name"
          value={form.school_name}
          onChangeText={(t) => set("school_name", t)}
          placeholder="Delhi Public School"
          error={errors.school_name}
        />
        <Field
          label="Class"
          value={form.class_name ?? ""}
          onChangeText={(t) => set("class_name", t)}
          placeholder="5th B"
          required={false}
        />
        <Field
          label="Pickup address"
          value={form.address}
          onChangeText={(t) => set("address", t)}
          placeholder="Flat 302, Green Residency, Sector 14"
          error={errors.address}
          multiline
        />

        {/* Parent details */}
        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3 mt-2">
          Parent / guardian
        </Text>

        <Field
          label="Parent name"
          value={form.parent_name}
          onChangeText={(t) => set("parent_name", t)}
          placeholder="Rajesh Sharma"
          error={errors.parent_name}
        />
        <Field
          label="Mobile number"
          value={form.parent_phone}
          onChangeText={(t) => set("parent_phone", t.replace(/[^0-9]/g, ""))}
          placeholder="9876543210"
          error={errors.parent_phone}
          keyboardType="phone-pad"
          maxLength={10}
          prefix="+91"
        />

        {/* Transport */}
        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3 mt-2">
          Transport
        </Text>

        <Text className="text-white font-pregular text-sm mb-1.5 ml-1">
          Assign route
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
              Tap to create one, or admit now and assign later.
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
                onPress={() => {
                  set("route_id", r.id);
                  // Prefill the route's default fee if none entered yet
                  if (!form.monthly_fee && r.default_fee) {
                    set("monthly_fee", r.default_fee);
                  }
                }}
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

        {!form.route_id && (
          <View className="border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-4">
            <Text className="text-gray-400 text-xs">
              Without a route this student is saved as pending and won't count
              as active.
            </Text>
          </View>
        )}

        <Field
          label="Pickup stop"
          value={form.pickup_stop ?? ""}
          onChangeText={(t) => set("pickup_stop", t)}
          placeholder="Green Residency Gate"
          required={false}
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
          required={false}
          error={errors.monthly_fee}
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
              {uploadProgress < 70 ? "Uploading photo…" : "Saving admission…"}
            </Text>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          className={`h-14 justify-center items-center rounded-xl mb-3 ${
            submitting ? "bg-yellow-700" : "bg-yellow-500"
          }`}
        >
          {submitting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text className="font-psemibold text-black text-base">
              Admit student
            </Text>
          )}
        </TouchableOpacity>

        <Text className="text-gray-600 text-xs text-center">
          This admission will be recorded under your name
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AddStudent;