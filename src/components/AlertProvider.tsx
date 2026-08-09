import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  ActivityIndicator,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

// ============================================================
// Types
// ============================================================
export type AlertButtonStyle = "default" | "cancel" | "destructive";

export interface AlertButton {
  text: string;
  style?: AlertButtonStyle;
  onPress?: () => void | Promise<void>;
  /** Keeps the modal open and shows a spinner while onPress runs */
  keepOpenWhileLoading?: boolean;
}

export type AlertTone = "info" | "success" | "warning" | "danger";

export interface AlertOptions {
  title: string;
  message?: string;
  tone?: AlertTone;
  buttons?: AlertButton[];
  /** Tapping the backdrop dismisses. Defaults to true when a cancel button exists. */
  dismissable?: boolean;
}

interface AlertContextValue {
  /** Drop-in replacement for Alert.alert */
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: { tone?: AlertTone; dismissable?: boolean }
  ) => void;
  /** Promise-based yes/no. Resolves true when confirmed. */
  confirm: (opts: {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    tone?: AlertTone;
  }) => Promise<boolean>;
  /** Brief bottom toast, auto-dismisses */
  toast: (message: string, tone?: AlertTone) => void;
  hide: () => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

// ============================================================
// Tone styling
// ============================================================
const TONE = {
  info: {
    icon: "information-circle" as const,
    color: "#60A5FA",
    ring: "border-blue-900",
    bg: "bg-blue-950",
  },
  success: {
    icon: "checkmark-circle" as const,
    color: "#34D399",
    ring: "border-green-900",
    bg: "bg-green-950",
  },
  warning: {
    icon: "warning" as const,
    color: "#FACC15",
    ring: "border-yellow-800",
    bg: "bg-yellow-950",
  },
  danger: {
    icon: "alert-circle" as const,
    color: "#F87171",
    ring: "border-red-900",
    bg: "bg-red-950",
  },
};

// ============================================================
// Provider
// ============================================================
export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<AlertOptions | null>(null);
  const [visible, setVisible] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

  const [toastState, setToastState] = useState<{
    message: string;
    tone: AlertTone;
  } | null>(null);

  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const toastY = useRef(new Animated.Value(80)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----------------------------------------------------------
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 9,
          tension: 90,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacity.setValue(0);
      scale.setValue(0.92);
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // ----------------------------------------------------------
  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 120,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setOptions(null);
      setLoadingIndex(null);
    });
  }, []);

  const alert = useCallback<AlertContextValue["alert"]>(
    (title, message, buttons, opts) => {
      setOptions({
        title,
        message,
        tone: opts?.tone ?? "info",
        buttons: buttons?.length ? buttons : [{ text: "OK" }],
        dismissable:
          opts?.dismissable ??
          (buttons?.some((b) => b.style === "cancel") || !buttons?.length),
      });
      setLoadingIndex(null);
      setVisible(true);
    },
    []
  );

  const confirm = useCallback<AlertContextValue["confirm"]>(
    ({ title, message, confirmText, cancelText, tone }) =>
      new Promise<boolean>((resolve) => {
        setOptions({
          title,
          message,
          tone: tone ?? "warning",
          dismissable: true,
          buttons: [
            {
              text: cancelText ?? "Cancel",
              style: "cancel",
              onPress: () => resolve(false),
            },
            {
              text: confirmText ?? "Confirm",
              style: tone === "danger" ? "destructive" : "default",
              onPress: () => resolve(true),
            },
          ],
        });
        setLoadingIndex(null);
        setVisible(true);
      }),
    []
  );

  const toast = useCallback((message: string, tone: AlertTone = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);

    setToastState({ message, tone });
    toastY.setValue(80);

    Animated.spring(toastY, {
      toValue: 0,
      friction: 9,
      tension: 80,
      useNativeDriver: true,
    }).start();

    toastTimer.current = setTimeout(() => {
      Animated.timing(toastY, {
        toValue: 80,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setToastState(null));
    }, 2600);
  }, []);

  // ----------------------------------------------------------
  const handlePress = async (button: AlertButton, index: number) => {
    if (loadingIndex !== null) return; // a button is already running

    if (button.keepOpenWhileLoading && button.onPress) {
      setLoadingIndex(index);
      try {
        await button.onPress();
      } finally {
        hide();
      }
      return;
    }

    hide();
    // Let the close animation start before the handler navigates
    setTimeout(() => button.onPress?.(), 60);
  };

  const handleBackdrop = () => {
    if (!options?.dismissable || loadingIndex !== null) return;

    // Treat a backdrop tap as pressing cancel, so promises resolve
    const cancelBtn = options.buttons?.find((b) => b.style === "cancel");
    hide();
    if (cancelBtn?.onPress) setTimeout(() => cancelBtn.onPress?.(), 60);
  };

  const tone = TONE[options?.tone ?? "info"];
  const buttons = options?.buttons ?? [];
  // Two short buttons sit side by side; more than two stack
  const sideBySide =
    buttons.length === 2 && buttons.every((b) => b.text.length <= 14);

  return (
    <AlertContext.Provider value={{ alert, confirm, toast, hide }}>
      {children}

      {/* ---------------- Modal ---------------- */}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleBackdrop}
      >
        <TouchableWithoutFeedback onPress={handleBackdrop}>
          <Animated.View
            style={{ opacity }}
            className="flex-1 bg-black/70 items-center justify-center px-8"
          >
            <TouchableWithoutFeedback onPress={() => {}}>
              <Animated.View
                style={{ transform: [{ scale }] }}
                className="w-full max-w-sm bg-[#0F1B24] border border-[#665524] rounded-2xl overflow-hidden"
              >
                <View className="px-5 pt-6 pb-5 items-center">
                  <View
                    className={`w-14 h-14 rounded-full items-center justify-center mb-3 border ${tone.bg} ${tone.ring}`}
                  >
                    <Ionicons name={tone.icon} size={28} color={tone.color} />
                  </View>

                  <Text
                    className="text-white font-psemibold text-base text-center"
                    maxFontSizeMultiplier={1.2}
                  >
                    {options?.title}
                  </Text>

                  {options?.message ? (
                    <Text
                      className="text-gray-400 text-xs text-center mt-2 leading-5"
                      maxFontSizeMultiplier={1.2}
                    >
                      {options.message}
                    </Text>
                  ) : null}
                </View>

                <View
                  className={`border-t border-gray-800 p-3 gap-2 ${
                    sideBySide ? "flex-row" : ""
                  }`}
                >
                  {buttons.map((button, i) => {
                    const isCancel = button.style === "cancel";
                    const isDestructive = button.style === "destructive";
                    const isLoading = loadingIndex === i;

                    return (
                      <TouchableOpacity
                        key={`${button.text}-${i}`}
                        onPress={() => handlePress(button, i)}
                        disabled={loadingIndex !== null}
                        activeOpacity={0.8}
                        className={`h-12 rounded-xl items-center justify-center ${
                          sideBySide ? "flex-1" : "w-full"
                        } ${
                          isCancel
                            ? "bg-transparent border border-gray-700"
                            : isDestructive
                              ? "bg-red-950 border border-red-900"
                              : "bg-yellow-500"
                        } ${loadingIndex !== null && !isLoading ? "opacity-40" : ""}`}
                      >
                        {isLoading ? (
                          <ActivityIndicator
                            size="small"
                            color={isDestructive ? "#F87171" : "#000"}
                          />
                        ) : (
                          <Text
                            className={`font-psemibold text-sm ${
                              isCancel
                                ? "text-gray-300"
                                : isDestructive
                                  ? "text-red-300"
                                  : "text-black"
                            }`}
                            maxFontSizeMultiplier={1.1}
                            numberOfLines={1}
                          >
                            {button.text}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ---------------- Toast ---------------- */}
      {toastState && (
        <Animated.View
          pointerEvents="none"
          style={{
            transform: [{ translateY: toastY }],
            position: "absolute",
            bottom: Platform.OS === "ios" ? 100 : 80,
            left: 20,
            right: 20,
          }}
        >
          <View
            className={`flex-row items-center gap-3 rounded-xl border px-4 py-3 ${
              TONE[toastState.tone].bg
            } ${TONE[toastState.tone].ring}`}
          >
            <Ionicons
              name={TONE[toastState.tone].icon}
              size={18}
              color={TONE[toastState.tone].color}
            />
            <Text
              className="text-white font-pmedium text-xs flex-1"
              numberOfLines={2}
            >
              {toastState.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </AlertContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================
export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error("useAlert must be used inside <AlertProvider>");
  }
  return ctx;
}