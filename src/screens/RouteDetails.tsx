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
import React, { useEffect, useState, useMemo } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
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
import { useAlert } from "@/components/AlertProvider";

// ============================================================
// Reusable field
// ============================================================
const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  prefix,
  changed,
  error,
  keyboardType = "default",
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  prefix?: string;
  changed?: boolean;
  error?: string;
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
        multiline={multiline}
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
export default function RouteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { alert, confirm, toast } = useAlert();

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
  const [nameError, setNameError] = useState<string | undefined>();
  const [newStop, setNewStop] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingStop, setAddingStop] = useState(false);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (summaries.length === 0) dispatch(fetchRouteSummaries());
    dispatch(fetchRouteStops(id));
    return () => {
      dispatch(clearRouteSubmitState());
    };
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
      setNameError(undefined);
    }
  }, [route?.id]);

  // Surface thunk failures (e.g. deactivating a route with students on it)
  useEffect(() => {
    if (submitError) {
      alert("Couldn't save", submitError, undefined, { tone: "danger" });
      dispatch(clearRouteSubmitState());
    }
  }, [submitError]);

  // ----------------------------------------------------------
  // Diff — only changed fields get sent
  // ----------------------------------------------------------
  const changes = useMemo(() => {
    if (!route) return {} as Record<string, any>;
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

  // ----------------------------------------------------------
  const handleSave = async () => {
    if (!isDirty) return;

    if (!form.name.trim() || form.name.trim().length < 3) {
      setNameError("Route name needs at least 3 characters");
      toast("Check the route name", "warning");
      return;
    }

    setNameError(undefined);
    setSaving(true);
    const result = await dispatch(updateRoute({ id, changes }));
    setSaving(false);

    if (updateRoute.fulfilled.match(result)) {
      dispatch(fetchRouteSummaries());
      toast("Route details saved");
    }
  };

  const handleAddStop = async () => {
    const name = newStop.trim();
    if (!name || addingStop) return;

    if (name.length < 2) {
      toast("Stop name is too short", "warning");
      return;
    }

    const dupe = routeStops.some(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (dupe) {
      alert(
        "Duplicate stop",
        "That stop already exists on this route.",
        undefined,
        { tone: "warning" }
      );
      return;
    }

    setAddingStop(true);
    const result = await dispatch(addRouteStop({ routeId: id, name }));
    setAddingStop(false);

    if (addRouteStop.fulfilled.match(result)) {
      setNewStop("");
      dispatch(fetchRouteSummaries());
      toast(`"${name}" added`);
    } else {
      alert("Couldn't add stop", result.payload as string, undefined, {
        tone: "danger",
      });
    }
  };

  const handleDeleteStop = async (stopId: string, name: string) => {
    const ok = await confirm({
      title: "Remove stop?",
      message: `"${name}" will be removed from this route.`,
      confirmText: "Remove",
      tone: "danger",
    });

    if (!ok) return;

    const result = await dispatch(deleteRouteStop({ routeId: id, stopId }));

    if (deleteRouteStop.fulfilled.match(result)) {
      dispatch(fetchRouteSummaries());
      toast("Stop removed");
    }
  };

  const handleToggleActive = async () => {
    if (!route) return;
    const turningOff = route.is_active;

    const ok = await confirm({
      title: turningOff ? "Deactivate route?" : "Activate route?",
      message: turningOff
        ? "It will stop appearing when admitting students."
        : "It will become selectable during admission.",
      confirmText: turningOff ? "Deactivate" : "Activate",
      tone: turningOff ? "danger" : "info",
    });

    if (!ok) return;

    const result = await dispatch(
      toggleRouteActive({ id, is_active: !route.is_active })
    );

    if (toggleRouteActive.fulfilled.match(result)) {
      dispatch(fetchRouteSummaries());
      toast(turningOff ? "Route deactivated" : "Route activated");
    }
    // Rejection is handled by the submitError effect above —
    // it carries the "N students are still on this route" message
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
        <Text className="text-gray-600 text-xs text-center">
          It may have been removed, or you don't have access to it.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="border border-yellow-400 px-6 h-11 rounded-xl justify-center mt-6"
        >
          <Text className="text-yellow-400 font-pmedium text-xs">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        <View className="flex-row items-center gap-3 mb-5">
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
            } ${!isAdmin ? "opacity-60" : ""}`}
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
              onChangeText={(t) => {
                setForm((p) => ({ ...p, name: t }));
                if (nameError) setNameError(undefined);
              }}
              placeholder="Route A — Sector 14"
              changed={changedKeys.has("name")}
              error={nameError}
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
                saving
                  ? "bg-yellow-700"
                  : isDirty
                    ? "bg-yellow-500"
                    : "bg-gray-800"
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
            {isAdmin
              ? "No stops yet. Add the first pickup point below."
              : "No stops have been added to this route."}
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
            <Text
              className="text-white font-pmedium text-sm flex-1"
              numberOfLines={1}
            >
              {stop.name}
            </Text>
            {isAdmin && (
              <TouchableOpacity
                onPress={() => handleDeleteStop(stop.id, stop.name)}
                hitSlop={10}
                className="w-7 h-7 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#F87171" />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {isAdmin && (
          <View className="flex-row items-center gap-2 mt-2">
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
                editable={!addingStop}
              />
            </View>
            <TouchableOpacity
              onPress={handleAddStop}
              disabled={!newStop.trim() || addingStop}
              className={`px-5 h-12 rounded-xl items-center justify-center ${
                newStop.trim() && !addingStop ? "bg-yellow-500" : "bg-gray-800"
              }`}
            >
              {addingStop ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text
                  className={`font-psemibold text-xs ${
                    newStop.trim() ? "text-black" : "text-gray-500"
                  }`}
                >
                  Add
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isAdmin && routeStops.length > 0 && (
          <Text className="text-gray-600 text-xs mt-3 ml-1">
            Stops are numbered in pickup order. Removing one renumbers the rest.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}