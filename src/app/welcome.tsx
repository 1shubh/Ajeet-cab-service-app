import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { supabase } from "@/lib/supabase";

const PhoneLogin = () => {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState("enterPhone"); // enterPhone or enterOtp

  // Send OTP
  const handleSendOtp = async () => {
    const fullPhone = `+91${phone}`;

    if (!phone) return Alert.alert("Error", "Enter mobile number");

    // 1️⃣ Check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("*")
      .eq("phone", fullPhone)
      .single();

    if (checkError || !existingUser) {
      return Alert.alert("Error", "This phone number is not registered");
    }

    // 2️⃣ Send OTP
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: fullPhone,
    });

    if (error) {
      console.log("OTP Error:", error);
      Alert.alert("Error sending OTP", error.message);
    } else {
      console.log("OTP sent successfully:", data);
      Alert.alert("Success", `OTP sent to ${fullPhone}`);
      setStage("enterOtp");
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    const fullPhone = `+91${phone}`;

    if (!otp) return Alert.alert("Error", "Enter OTP");

    const { data, error } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: otp,
      type: "sms",
    });

    if (error) {
      console.log("OTP Verification Error:", error);
      Alert.alert("Verification failed", error.message);
    } else {
      console.log("OTP Verified Successfully:", data);
      Alert.alert("Success", "OTP Verified! You are now logged in.");
      setStage("enterPhone");
      setPhone("");
      setOtp("");
      // Now user is logged in; you can save session or navigate
    }
  };

  return (
   <View>
     
   </View>
  );
};

export default PhoneLogin;