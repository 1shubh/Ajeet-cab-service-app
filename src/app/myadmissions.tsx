import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import React, { useEffect, useState, useCallback } from "react";
import { router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { fetchMyAdmissionStats, fetchStudents, resetStudentList } from "@/redux/slice/admissionslice";


// ============================================================
// Stat tile
// ============================================================
const StatTile = ({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: number | string;
  accent?: string;
}) => (
  <View className="flex-1 border border-gray-700 bg-darkinputbg rounded-xl p-3">
    <Text className="text-gray-400 text-xs mb-1" maxFontSizeMultiplier={1}>
      {label}
    </Text>
    <Text
      className={`text-2xl font-psemibold ${accent}`}
      maxFontSizeMultiplier={1}
    >
      {value}
    </Text>
  </View>
);

// ============================================================
// Student row
// ============================================================
const StudentRow = ({ student }: { student: Student }) => {
  const initials = student.student_name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const statusStyle =
    student.status === "active"
      ? "bg-green-950 text-green-300"
      : student.status === "pending"
        ? "bg-yellow-950 text-yellow-300"
        : "bg-gray-800 text-gray-400";

  return (
    <TouchableOpacity
      onPress={() => router.push(`/student/${student.id}`)}
      className="border border-gray-700 bg-darkinputbg rounded-xl p-3 mb-2 flex-row items-center gap-3"
    >
      <View className="w-12 h-12 rounded-full border border-yellow-400/40 overflow-hidden items-center justify-center bg-[#1a1a2e]">
        {student.student_photo ? (
          <Image
            source={{ uri: student.student_photo }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <Text className="text-yellow-400 font-psemibold">{initials}</Text>
        )}
      </View>

      <View className="flex-1">
        <Text
          className="text-white font-pmedium text-sm"
          numberOfLines={1}
          maxFontSizeMultiplier={1}
        >
          {student.student_name}
        </Text>
        <Text className="text-gray-500 text-xs" numberOfLines={1}>
          {student.school_name}
        </Text>
        <Text className="text-gray-600 text-xs mt-0.5">
          {student.parent_name} · +91 {student.parent_phone}
        </Text>
      </View>

      <View className="items-end gap-1">
        <View className={`px-2 py-0.5 rounded-full ${statusStyle.split(" ")[0]}`}>
          <Text className={`text-xs ${statusStyle.split(" ")[1]}`}>
            {student.status}
          </Text>
        </View>
        <Text className="text-gray-600 text-xs">
          {student.routes?.name ?? "No route"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ============================================================
// Screen
// ============================================================
const MyAdmissions = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { students, listLoading, hasMore, page, myStats, listError } =
    useSelector((s: RootState) => s.admissions);
  const { profile } = useSelector((s: RootState) => s.profile);

  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = profile?.role === "admin";
  const scope = isAdmin ? "all" : "mine";

  const load = useCallback(
    (pageNum = 0, searchTerm = search) => {
      dispatch(fetchStudents({ page: pageNum, scope, search: searchTerm }));
    },
    [dispatch, scope, search]
  );

  useEffect(() => {
    dispatch(resetStudentList());
    load(0);
    if (!isAdmin) dispatch(fetchMyAdmissionStats());
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      dispatch(resetStudentList());
      load(0, search);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const onRefresh = async () => {
    setRefreshing(true);
    dispatch(resetStudentList());
    load(0);
    if (!isAdmin) await dispatch(fetchMyAdmissionStats());
    setRefreshing(false);
  };

  const loadMore = () => {
    if (!listLoading && hasMore) load(page + 1);
  };

  return (
    <View className="flex-1 bg-appBg px-3 pt-12">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View>
          <Text className="text-white font-psemibold text-lg">
            {isAdmin ? "All students" : "My admissions"}
          </Text>
          <Text className="text-gray-500 text-xs">
            {isAdmin
              ? "Every student across all routes"
              : "Students you have admitted"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/add-student")}
          className="bg-yellow-500 px-4 h-10 rounded-xl items-center justify-center"
        >
          <Text className="text-black font-psemibold text-xs">+ Admit</Text>
        </TouchableOpacity>
      </View>

      {/* Driver stats */}
      {!isAdmin && myStats && (
        <View className="flex-row gap-2 mb-4">
          <StatTile
            label="Total admitted"
            value={myStats.total_admissions}
            accent="text-yellow-400"
          />
          <StatTile
            label="Active"
            value={myStats.active_admissions}
            accent="text-green-400"
          />
          <StatTile
            label="This month"
            value={myStats.admissions_this_month}
            accent="text-blue-400"
          />
        </View>
      )}

      {/* Search */}
      <View className="border-2 border-[#665524] rounded-xl px-3 mb-3">
        <TextInput
          className="text-white font-pmedium h-11"
          placeholder="Search name, parent or phone"
          placeholderTextColor="#6b6b6b"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* List */}
      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <StudentRow student={item} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FACC15"
          />
        }
        ListEmptyComponent={
          listLoading ? (
            <ActivityIndicator color="#FACC15" className="mt-10" />
          ) : (
            <View className="items-center mt-16 px-8">
              <Text className="text-gray-400 font-pmedium text-base mb-1">
                {search ? "No matches" : "No admissions yet"}
              </Text>
              <Text className="text-gray-600 text-xs text-center">
                {search
                  ? "Try a different name or number"
                  : "Tap Admit to add your first student"}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          listLoading && students.length > 0 ? (
            <ActivityIndicator color="#FACC15" className="my-4" />
          ) : (
            <View className="h-8" />
          )
        }
      />

      {listError && (
        <View className="border border-red-900 bg-red-950 rounded-xl p-3 mb-3">
          <Text className="text-red-300 text-xs">{listError}</Text>
        </View>
      )}
    </View>
  );
};

export default MyAdmissions;