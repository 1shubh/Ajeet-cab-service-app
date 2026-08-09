// src/app/student/[id].tsx
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useAlert } from "@/components/AlertProvider";
import React, { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { supabase } from "@/lib/supabase";
import { Student } from "@/redux/slice/admissionslice";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <View className="flex-row justify-between py-3 border-b border-gray-800">
    <Text className="text-gray-500 text-xs">{label}</Text>
    <Text
      className="text-white text-xs font-pmedium flex-1 text-right ml-4"
      numberOfLines={2}
    >
      {value || "—"}
    </Text>
  </View>
);

export default function StudentDetail() {
  const { alert, confirm, toast } = useAlert();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSelector((s: RootState) => s.profile);
  const insets = useSafeAreaInsets();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";
  const canEdit = isAdmin || student?.admitted_by === profile?.id;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, routes(id, name), admitter:admitted_by(id, name, role)")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;

      if (error) setError(error.message);
      else if (!data) setError("Student not found or you don't have access");
      else setStudent(data as Student);

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const callParent = () => {
    if (student?.parent_phone)
      Linking.openURL(`tel:+91${student.parent_phone}`);
  };

  // const deactivate = () => {
  //   alert(
  //     "Deactivate student",
  //     `${student?.student_name} will stop appearing in active counts. This can be undone.`,
  //     [
  //       { text: "Cancel", style: "cancel" },
  //       {
  //         text: "Deactivate",
  //         style: "destructive",
  //         onPress: async () => {
  //           const { error } = await supabase
  //             .from("students")
  //             .update({ status: "inactive" })
  //             .eq("id", id);

  //           if (error) alert("Failed", error.message);
  //           else router.back();
  //         },
  //       },
  //     ],
  //   );
  // };
  const deactivate = () => {
  alert(
    "Deactivate student",
    `${student?.student_name} will stop appearing in active counts. This can be undone.`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate",
        style: "destructive",
        keepOpenWhileLoading: true,
        onPress: async () => {
          const { error } = await supabase
            .from("students")
            .update({ status: "inactive" })
            .eq("id", id);

          if (error) {
            toast(error.message, "danger");
          } else {
            toast("Student deactivated");
            router.back();
          }
        },
      },
    ],
    { tone: "danger" }
  );
};

  if (loading) {
    return (
      <View className="flex-1 bg-appBg items-center justify-center">
        <ActivityIndicator color="#FACC15" size="large" />
      </View>
    );
  }

  if (error || !student) {
    return (
      <View className="flex-1 bg-appBg items-center justify-center px-8">
        <Text className="text-gray-400 font-pmedium mb-2">
          Couldn't load student
        </Text>
        <Text className="text-gray-600 text-xs text-center mb-6">{error}</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="border border-yellow-400 px-6 h-11 rounded-xl justify-center"
        >
          <Text className="text-yellow-400 font-pmedium text-xs">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = student.student_name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      className="flex-1 bg-appBg "
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 40,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <TouchableOpacity
        onPress={() => router.back()}
        className="w-10 h-10 rounded-full border border-[#665524] items-center justify-center mb-4"
      >
        {/* <Text className="text-yellow-400 text-lg">←</Text> */}
        <Ionicons name="arrow-back" size={15} color="yellow" />
      </TouchableOpacity>

      {/* Photo + name */}
      <View className="items-center mb-6">
        <View className="w-24 h-24 rounded-full border-2 border-yellow-400 overflow-hidden items-center justify-center bg-darkinputbg mb-3">
          {student.student_photo ? (
            <Image
              source={{ uri: student.student_photo }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Text className="text-yellow-400 font-psemibold text-2xl">
              {initials}
            </Text>
          )}
        </View>
        <Text className="text-white font-psemibold text-lg">
          {student.student_name}
        </Text>
        <View
          className={`px-3 py-1 rounded-full mt-1 ${
            student.status === "active"
              ? "bg-green-950"
              : student.status === "pending"
                ? "bg-yellow-950"
                : "bg-gray-800"
          }`}
        >
          <Text
            className={`text-xs ${
              student.status === "active"
                ? "text-green-300"
                : student.status === "pending"
                  ? "text-yellow-300"
                  : "text-gray-400"
            }`}
          >
            {student.status}
          </Text>
        </View>
      </View>

      {/* Call parent */}
      <TouchableOpacity
        onPress={callParent}
        className="bg-yellow-500 h-12 rounded-xl items-center justify-center mb-5"
      >
        <Text className="text-black font-psemibold text-sm">
          Call {student.parent_name}
        </Text>
      </TouchableOpacity>
      {canEdit && (
        <TouchableOpacity
          onPress={() => router.push(`/student/edit/${student.id}`)}
          className="border border-yellow-400 h-12 rounded-xl items-center justify-center mb-3"
        >
          <Text className="text-yellow-400 font-pmedium text-sm">
            Edit details
          </Text>
        </TouchableOpacity>
      )}

      <Text className="text-gray-500 text-xs uppercase tracking-widest mb-1">
        Student
      </Text>
      <View className="border border-gray-700 bg-darkinputbg rounded-xl px-4 mb-4">
        <Row label="School" value={student.school_name} />
        <Row label="Class" value={student.class_name} />
        <Row label="Address" value={student.address} />
      </View>

      <Text className="text-gray-500 text-xs uppercase tracking-widest mb-1">
        Parent
      </Text>
      <View className="border border-gray-700 bg-darkinputbg rounded-xl px-4 mb-4">
        <Row label="Name" value={student.parent_name} />
        <Row label="Mobile" value={`+91 ${student.parent_phone}`} />
      </View>

      <Text className="text-gray-500 text-xs uppercase tracking-widest mb-1">
        Transport
      </Text>
      <View className="border border-gray-700 bg-darkinputbg rounded-xl px-4 mb-4">
        <Row label="Route" value={student.routes?.name} />
        <Row label="Pickup stop" value={student.pickup_stop} />
        <Row
          label="Monthly fee"
          value={student.monthly_fee ? `₹${student.monthly_fee}` : null}
        />
      </View>

      <Text className="text-gray-500 text-xs uppercase tracking-widest mb-1">
        Admission
      </Text>
      <View className="border border-gray-700 bg-darkinputbg rounded-xl px-4 mb-6">
        <Row label="Admitted by" value={student.admitter?.name} />
        <Row label="Role" value={student.admitted_by_role} />
        <Row
          label="Date"
          value={new Date(student.admission_date).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        />
      </View>

      {canEdit && student.status !== "inactive" && (
        <TouchableOpacity
          onPress={deactivate}
          className="border border-red-900 h-12 rounded-xl items-center justify-center mb-10"
        >
          <Text className="text-red-400 font-pmedium text-sm">
            Deactivate student
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
