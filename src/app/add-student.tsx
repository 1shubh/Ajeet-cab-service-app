import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import React, { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { AdmissionInput, clearSubmitState, createAdmission, validateAdmission } from "@/redux/slice/admissionslice";
import { fetchRoutes } from "@/redux/slice/routeslice";
import Ionicons from '@expo/vector-icons/Ionicons';



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
      } ${multiline ? "py-2" : ""}`}
    >
      {prefix && (
        <Text className="text-gray-400 font-pmedium mr-1">{prefix}</Text>
      )}
      <TextInput
        className="flex-1 text-white font-pmedium"
        style={multiline ? { height: 80, textAlignVertical: "top" } : { height: 48 }}
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
const AddStudent = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { submitting, submitError, uploadProgress } = useSelector(
    (s: RootState) => s.admissions
  );
  const { profile } = useSelector((s: RootState) => s.profile);
  const { routes } = useSelector((s: RootState) => s.routes);

  const [form, setForm] = useState<AdmissionInput>({
    student_name: "",
    student_photo_uri: null,
    school_name: "",
    address: "",
    class_name: "",
    parent_name: "",
    parent_phone: "",
    route_id: null,
    pickup_stop: "",
    monthly_fee: 0,
  });

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

  // ----------------------------------------------------------
  // Photo picker — camera or gallery
  // ----------------------------------------------------------
  const pickPhoto = async (source: "camera" | "gallery") => {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        `Allow ${source === "camera" ? "camera" : "photo library"} access to add a student photo.`
      );
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6, // keeps uploads under ~300 KB
    };

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled && result.assets?.[0]) {
      set("student_photo_uri", result.assets[0].uri);
    }
  };

  const choosePhoto = () => {
    Alert.alert("Student photo", "Choose a source", [
      { text: "Take photo", onPress: () => pickPhoto("camera") },
      { text: "Choose from gallery", onPress: () => pickPhoto("gallery") },
      form.student_photo_uri
        ? { text: "Remove photo", style: "destructive" as const, onPress: () => set("student_photo_uri", null) }
        : { text: "Cancel", style: "cancel" as const },
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  // ----------------------------------------------------------
  // Submit
  // ----------------------------------------------------------
  const handleSubmit = async () => {
    const validationErrors = validateAdmission(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const result = await dispatch(createAdmission(form));

    if (createAdmission.fulfilled.match(result)) {
      Alert.alert(
        "Student admitted",
        `${result.payload.student_name} has been added${
          form.route_id ? "" : ". Assign a route to activate them."
        }`,
        [
          {
            text: "Add another",
            onPress: () =>
              setForm({
                student_name: "",
                student_photo_uri: null,
                school_name: form.school_name, // keep — usually the same school
                address: "",
                class_name: "",
                parent_name: "",
                parent_phone: "",
                route_id: form.route_id, // keep — usually the same route
                pickup_stop: "",
                monthly_fee: form.monthly_fee,
              }),
          },
          { text: "Done", onPress: () => router.back() },
        ]
      );
    }
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
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-appBg"
    >
      <ScrollView
        className="flex-1 px-4 pt-12"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center gap-3 mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full border border-[#665524] items-center justify-center"
          >
            {/* <Text className="text-yellow-400 text-lg">

            </Text> */}
            <Ionicons name="arrow-back" size={15} color="yellow" />
          </TouchableOpacity>
          <View>
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

          {routes?.map((r: any) => (
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
          onChangeText={(t) => set("monthly_fee", Number(t.replace(/[^0-9]/g, "")) || 0)}
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

        <Text className="text-gray-600 text-xs text-center mb-10">
          This admission will be recorded under your name
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AddStudent;