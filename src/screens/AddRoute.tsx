import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import {
  createRoute,
  validateRoute,
  clearRouteSubmitState,
  RouteInput,
} from "@/redux/slice/routeslice";
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAlert } from "@/components/AlertProvider";
// ------------------------------------------------------------
const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType = "default",
  prefix,
  required = true,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  error?: string;
  keyboardType?: "default" | "numeric";
  prefix?: string;
  required?: boolean;
  multiline?: boolean;
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
      {prefix && <Text className="text-gray-400 font-pmedium mr-1">{prefix}</Text>}
      <TextInput
        className="flex-1 text-white font-pmedium"
        style={multiline ? { height: 70, textAlignVertical: "top", paddingTop: 10 } : { height: 48 }}
        placeholder={placeholder}
        placeholderTextColor="#6b6b6b"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
    {error ? <Text className="text-red-400 text-xs mt-1 ml-1">{error}</Text> : null}
  </View>
);

// ------------------------------------------------------------
export default function AddRoute() {
  const dispatch = useDispatch<AppDispatch>();
  const { submitting, submitError } = useSelector((s: RootState) => s.routes);
  const {alert,confirm,toast} = useAlert()
  const [form, setForm] = useState<RouteInput>({
    name: "",
    start_point: "",
    end_point: "",
    default_fee: 0,
    notes: "",
    stops: [{ name: "" }],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => () => { dispatch(clearRouteSubmitState()); }, []);

  const set = (key: keyof RouteInput, value: any) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key]) {
      setErrors((p) => {
        const n = { ...p };
        delete n[key as string];
        return n;
      });
    }
  };

  const setStop = (index: number, name: string) => {
    const stops = [...(form.stops ?? [])];
    stops[index] = { ...stops[index], name };
    set("stops", stops);
  };

  const addStop = () => set("stops", [...(form.stops ?? []), { name: "" }]);

  const removeStop = (index: number) =>
    set(
      "stops",
      (form.stops ?? []).filter((_, i) => i !== index)
    );

  const handleSubmit = async () => {
    const v = validateRoute(form);
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }

    const result = await dispatch(createRoute(form));

    if (createRoute.fulfilled.match(result)) {
      Alert.alert(
        "Route created",
        `${result.payload.name} is now available when admitting students.`,
        [
          {
            text: "Add another",
            onPress: () =>
              setForm({
                name: "",
                start_point: "",
                end_point: "",
                default_fee: form.default_fee,
                notes: "",
                stops: [{ name: "" }],
              }),
          },
          { text: "Done", onPress: () => router.back() },
        ]
      );
    }
  };

  const filledStops = (form.stops ?? []).filter((s) => s.name.trim()).length;

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
        <View className="flex-row items-center gap-3 mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full border border-[#665524] items-center justify-center"
          >
            {/* <Text className="text-yellow-400 text-lg">←</Text> */}
             <Ionicons name="arrow-back" size={15} color="yellow" />
          </TouchableOpacity>
          <View>
            <Text className="text-white font-psemibold text-lg">New route</Text>
            <Text className="text-gray-500 text-xs">
              {filledStops} stop{filledStops === 1 ? "" : "s"} added
            </Text>
          </View>
        </View>

        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3">
          Route details
        </Text>

        <Field
          label="Route name"
          value={form.name}
          onChangeText={(t) => set("name", t)}
          placeholder="Route A — Sector 14"
          error={errors.name}
        />

        <Field
          label="Starts at"
          value={form.start_point ?? ""}
          onChangeText={(t) => set("start_point", t)}
          placeholder="Sector 14 Main Gate"
          error={errors.start_point}
        />

        <Field
          label="Ends at"
          value={form.end_point ?? ""}
          onChangeText={(t) => set("end_point", t)}
          placeholder="Delhi Public School"
          error={errors.end_point}
        />

        <Field
          label="Default monthly fee"
          value={form.default_fee ? String(form.default_fee) : ""}
          onChangeText={(t) =>
            set("default_fee", Number(t.replace(/[^0-9]/g, "")) || 0)
          }
          placeholder="1500"
          keyboardType="numeric"
          prefix="₹"
          required={false}
          error={errors.default_fee}
        />

        {/* Stops */}
        <View className="flex-row items-center justify-between mb-3 mt-2">
          <Text className="text-gray-500 text-xs uppercase tracking-widest">
            Pickup stops
          </Text>
          <TouchableOpacity onPress={addStop} hitSlop={8}>
            <Text className="text-yellow-400 text-xs font-pmedium">+ Add stop</Text>
          </TouchableOpacity>
        </View>

        {errors.stops && (
          <Text className="text-red-400 text-xs mb-2 ml-1">{errors.stops}</Text>
        )}

        {(form.stops ?? []).map((stop, i) => (
          <View key={i} className="flex-row items-center gap-2 mb-2">
            <View className="w-7 h-7 rounded-full bg-[#2a2412] items-center justify-center">
              <Text className="text-yellow-400 text-xs font-pmedium">{i + 1}</Text>
            </View>
            <View className="flex-1 border-2 border-[#665524] rounded-xl px-3">
              <TextInput
                className="text-white font-pmedium"
                style={{ height: 46 }}
                placeholder={`Stop ${i + 1} name`}
                placeholderTextColor="#6b6b6b"
                value={stop.name}
                onChangeText={(t) => setStop(i, t)}
              />
            </View>
            {(form.stops ?? []).length > 1 && (
              <TouchableOpacity
                onPress={() => removeStop(i)}
                hitSlop={8}
                className="w-8 h-8 items-center justify-center"
              >
                <Text className="text-red-400 text-lg">×</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <Text className="text-gray-600 text-xs mt-1 mb-4 ml-1">
          Stops are saved in this order — first is picked up first.
        </Text>

        <Field
          label="Notes"
          value={form.notes ?? ""}
          onChangeText={(t) => set("notes", t)}
          placeholder="Avoid the market road before 8 AM"
          required={false}
          multiline
        />

        {submitError && (
          <View className="border border-red-900 bg-red-950 rounded-xl p-3 mb-4">
            <Text className="text-red-300 text-xs font-pmedium">{submitError}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          className={`h-14 justify-center items-center rounded-xl mb-10 ${
            submitting ? "bg-yellow-700" : "bg-yellow-500"
          }`}
        >
          {submitting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text className="font-psemibold text-black text-base">
              Create route
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}