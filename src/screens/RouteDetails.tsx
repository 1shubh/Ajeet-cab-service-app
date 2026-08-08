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
import React, { useEffect, useState, useMemo } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import {
  fetchRouteStops,
  fetchRouteSummaries,
  updateRoute,
  addRouteStop,
  deleteRouteStop,
  toggleRouteActive,
  clearRouteSubmitState,
} from "@/redux/slice/routeslice";
import Ionicons from "@expo/vector-icons/Ionicons";
// ------------------------------------------------------------
const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  prefix,
  changed,
  keyboardType = "default",
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  prefix?: string;
  changed?: boolean;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
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
        changed ? "border-yellow-400" : "border-[#665524]"
      }`}
    >
      {prefix && <Text className="text-gray-400 font-pmedium mr-1">{prefix}</Text>}
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
        multiline={multiline}
      />
    </View>
  </View>
);

// ------------------------------------------------------------
export default function RouteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();

  const { summaries, stops, loading, submitError } = useSelector(
    (s: RootState) => s.routes
  );
  const { profile } = useSelector((s: RootState) => s.profile);

  const route = summaries.find((r) => r.id === id);
  const routeStops = stops[id] ?? [];

  const [form, setForm] = useState({
    name: "",
    start_point: "",
    end_point: "",
    default_fee: 0,
    notes: "",
  });
  const [newStop, setNewStop] = useState("");
  const [saving, setSaving] = useState(false);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (summaries.length === 0) dispatch(fetchRouteSummaries());
    dispatch(fetchRouteStops(id));
    return () => { dispatch(clearRouteSubmitState()); };
  }, [id]);

  useEffect(() => {
    if (route) {
      setForm({
        name: route.name,
        start_point: route.start_point ?? "",
        end_point: route.end_point ?? "",
        default_fee: route.default_fee ?? 0,
        notes: route.notes ?? "",
      });
    }
  }, [route?.id]);

  useEffect(() => {
    if (submitError) Alert.alert("Couldn't save", submitError);
  }, [submitError]);

  const changes = useMemo(() => {
    if (!route) return {};
    const diff: Record<string, any> = {};
    if (form.name !== route.name) diff.name = form.name;
    if (form.start_point !== (route.start_point ?? ""))
      diff.start_point = form.start_point;
    if (form.end_point !== (route.end_point ?? ""))
      diff.end_point = form.end_point;
    if (form.default_fee !== (route.default_fee ?? 0))
      diff.default_fee = form.default_fee;
    if (form.notes !== (route.notes ?? "")) diff.notes = form.notes;
    return diff;
  }, [form, route]);

  const isDirty = Object.keys(changes).length > 0;
  const changedKeys = new Set(Object.keys(changes));

  const handleSave = async () => {
    if (!isDirty) return;
    if (!form.name.trim() || form.name.trim().length < 3) {
      Alert.alert("Invalid name", "Route name needs at least 3 characters.");
      return;
    }

    setSaving(true);
    const result = await dispatch(updateRoute({ id, changes }));
    setSaving(false);

    if (updateRoute.fulfilled.match(result)) {
      dispatch(fetchRouteSummaries());
      Alert.alert("Saved", "Route details updated.");
    }
  };

  const handleAddStop = async () => {
    if (!newStop.trim()) return;

    const dupe = routeStops.some(
      (s) => s.name.toLowerCase() === newStop.trim().toLowerCase()
    );
    if (dupe) {
      Alert.alert("Duplicate stop", "That stop already exists on this route.");
      return;
    }

    await dispatch(addRouteStop({ routeId: id, name: newStop }));
    setNewStop("");
    dispatch(fetchRouteSummaries());
  };

  const handleDeleteStop = (stopId: string, name: string) => {
    Alert.alert("Remove stop?", `"${name}" will be removed from this route.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await dispatch(deleteRouteStop({ routeId: id, stopId }));
          dispatch(fetchRouteSummaries());
        },
      },
    ]);
  };

  const handleToggleActive = () => {
    if (!route) return;
    const off = route.is_active;
    Alert.alert(
      off ? "Deactivate route?" : "Activate route?",
      off
        ? "It will stop appearing when admitting students."
        : "It will become selectable during admission.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: off ? "Deactivate" : "Activate",
          style: off ? "destructive" : "default",
          onPress: async () => {
            await dispatch(
              toggleRouteActive({ id, is_active: !route.is_active })
            );
            dispatch(fetchRouteSummaries());
          },
        },
      ]
    );
  };

  const handleBack = () => {
    if (!isDirty) {
      router.back();
      return;
    }
    Alert.alert("Discard changes?", "Your edits haven't been saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => router.back() },
    ]);
  };

  if (loading && !route) {
    return (
      <View className="flex-1 bg-appBg items-center justify-center">
        <ActivityIndicator color="#FACC15" size="large" />
      </View>
    );
  }

  if (!route) {
    return (
      <View className="flex-1 bg-appBg items-center justify-center px-8">
        <Text className="text-gray-300 font-pmedium mb-2">Route not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="border border-yellow-400 px-6 h-11 rounded-xl justify-center mt-4"
        >
          <Text className="text-yellow-400 font-pmedium text-xs">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        <View className="flex-row items-center gap-3 mb-5">
          <TouchableOpacity
            onPress={handleBack}
            className="w-10 h-10 rounded-full border border-[#665524] items-center justify-center"
          >
               <Ionicons name="arrow-back" size={15} color="yellow" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white font-psemibold text-lg" numberOfLines={1}>
              {route.name}
            </Text>
            <Text className="text-gray-500 text-xs">
              {route.student_count} student
              {route.student_count === 1 ? "" : "s"} · {routeStops.length} stop
              {routeStops.length === 1 ? "" : "s"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleToggleActive}
            disabled={!isAdmin}
            className={`px-3 py-1.5 rounded-full ${
              route.is_active ? "bg-green-950" : "bg-gray-800"
            }`}
          >
            <Text
              className={`text-xs font-pmedium ${
                route.is_active ? "text-green-300" : "text-gray-400"
              }`}
            >
              {route.is_active ? "Active" : "Inactive"}
            </Text>
          </TouchableOpacity>
        </View>

        {!isAdmin && (
          <View className="border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-5">
            <Text className="text-gray-400 text-xs">
              Only admins can edit routes. You're viewing in read-only mode.
            </Text>
          </View>
        )}

        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3">
          Route details
        </Text>

        {isAdmin ? (
          <>
            <Field
              label="Route name"
              value={form.name}
              onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
              placeholder="Route A — Sector 14"
              changed={changedKeys.has("name")}
            />
            <Field
              label="Starts at"
              value={form.start_point}
              onChangeText={(t) => setForm((p) => ({ ...p, start_point: t }))}
              placeholder="Sector 14 Main Gate"
              changed={changedKeys.has("start_point")}
            />
            <Field
              label="Ends at"
              value={form.end_point}
              onChangeText={(t) => setForm((p) => ({ ...p, end_point: t }))}
              placeholder="Delhi Public School"
              changed={changedKeys.has("end_point")}
            />
            <Field
              label="Default monthly fee"
              value={form.default_fee ? String(form.default_fee) : ""}
              onChangeText={(t) =>
                setForm((p) => ({
                  ...p,
                  default_fee: Number(t.replace(/[^0-9]/g, "")) || 0,
                }))
              }
              placeholder="1500"
              keyboardType="numeric"
              prefix="₹"
              changed={changedKeys.has("default_fee")}
            />
            <Field
              label="Notes"
              value={form.notes}
              onChangeText={(t) => setForm((p) => ({ ...p, notes: t }))}
              placeholder="Avoid the market road before 8 AM"
              multiline
              changed={changedKeys.has("notes")}
            />

            <TouchableOpacity
              onPress={handleSave}
              disabled={!isDirty || saving}
              className={`h-12 justify-center items-center rounded-xl mb-6 ${
                saving ? "bg-yellow-700" : isDirty ? "bg-yellow-500" : "bg-gray-800"
              }`}
            >
              {saving ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text
                  className={`font-psemibold text-sm ${
                    isDirty ? "text-black" : "text-gray-500"
                  }`}
                >
                  {isDirty ? "Save route details" : "No changes"}
                </Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <View className="border border-gray-700 bg-darkinputbg rounded-xl px-4 mb-6">
            {[
              ["Starts at", route.start_point],
              ["Ends at", route.end_point],
              ["Monthly fee", `₹${route.default_fee ?? 0}`],
              ["Driver", route.driver_name],
            ].map(([label, value]) => (
              <View
                key={label as string}
                className="flex-row justify-between py-3 border-b border-gray-800"
              >
                <Text className="text-gray-500 text-xs">{label}</Text>
                <Text className="text-white text-xs font-pmedium">
                  {value || "—"}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Stops */}
        <Text className="text-gray-500 text-xs uppercase tracking-widest mb-3">
          Pickup stops
        </Text>

        {routeStops.length === 0 && (
          <Text className="text-gray-600 text-xs mb-3 ml-1">
            No stops yet. Add the first pickup point below.
          </Text>
        )}

        {routeStops.map((stop) => (
          <View
            key={stop.id}
            className="flex-row items-center gap-3 border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-2"
          >
            <View className="w-7 h-7 rounded-full bg-[#2a2412] items-center justify-center">
              <Text className="text-yellow-400 text-xs font-pmedium">
                {stop.sequence}
              </Text>
            </View>
            <Text className="text-white font-pmedium text-sm flex-1" numberOfLines={1}>
              {stop.name}
            </Text>
            {isAdmin && (
              <TouchableOpacity
                onPress={() => handleDeleteStop(stop.id, stop.name)}
                hitSlop={8}
              >
                <Text className="text-red-400 text-lg">×</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {isAdmin && (
          <View className="flex-row items-center gap-2 mt-2 mb-10">
            <View className="flex-1 border-2 border-[#665524] rounded-xl px-3">
              <TextInput
                className="text-white font-pmedium"
                style={{ height: 46 }}
                placeholder="New stop name"
                placeholderTextColor="#6b6b6b"
                value={newStop}
                onChangeText={setNewStop}
                onSubmitEditing={handleAddStop}
                returnKeyType="done"
              />
            </View>
            <TouchableOpacity
              onPress={handleAddStop}
              disabled={!newStop.trim()}
              className={`px-5 h-12 rounded-xl items-center justify-center ${
                newStop.trim() ? "bg-yellow-500" : "bg-gray-800"
              }`}
            >
              <Text
                className={`font-psemibold text-xs ${
                  newStop.trim() ? "text-black" : "text-gray-500"
                }`}
              >
                Add
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}