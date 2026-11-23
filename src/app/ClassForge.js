// src/app/ClassForge.js
"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_USER_DATA,
  loadLocalUserData,
  saveLocalUserData,
} from "../lib/userData";
import { parseByFilename, parseTime, minutesToHHMM } from "../lib/parsers";
import { generateSchedules, rankSchedules } from "../lib/scheduler";
import { parseTrackerByFilename } from "../lib/trackerParser";
import { parseTranscriptByFilename } from "../lib/transcriptParser";
import {
  createScheduleSnapshot,
  restoreScheduleSelection,
} from "../lib/schedulePersistence";
import { ANALYTICS_EVENTS, getUtmParams, trackEvent } from "../lib/analytics";
import { BRAND } from "../lib/brand";
import {
  computeProgress,
  getTags,
  getCatalogTags,
  groupCompletedBySemester,
  computeGPA,
  generateForecastPlaceholders,
  semesterSortKey,
  distributeForecastAcrossSemesters,
  nextAcademicSemester,
} from "../lib/tracker";
import {
  applySampleData,
  hasSampleData,
  isSampleCourse,
  stripSampleData,
} from "../lib/sampleCatalog";
import {
  readWelcomeDismissed,
  shouldShowWelcome,
  writeWelcomeDismissed,
} from "../lib/welcomeState";

// ============================================================
// Theme tokens
// ============================================================
const T = {
  dark: {
    bg: "bg-slate-950",
    panel: "bg-slate-900",
    panel2: "bg-slate-900/80",
    border: "border-slate-800",
    border2: "border-slate-700",
    text: "text-slate-100",
    textDim: "text-slate-400",
    textMute: "text-slate-500",
    accent: "text-indigo-300",
    accentBg: "bg-indigo-600",
    accentBgH: "hover:bg-indigo-500",
    chip: "bg-slate-800 text-slate-200 border-slate-700",
    chipOn: "bg-indigo-500/20 text-indigo-200 border-indigo-700",
    input: "bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500",
    block: "bg-rose-500/30 border-rose-400/60 text-rose-100",
    progressBg: "bg-slate-800",
    progressFill: "bg-indigo-500",
    progressFillDone: "bg-emerald-500",
    semesterBg: "bg-slate-900/60",
  },
  light: {
    bg: "bg-slate-50",
    panel: "bg-white",
    panel2: "bg-white/90",
    border: "border-slate-200",
    border2: "border-slate-300",
    text: "text-slate-900",
    textDim: "text-slate-600",
    textMute: "text-slate-400",
    accent: "text-indigo-600",
    accentBg: "bg-indigo-600",
    accentBgH: "hover:bg-indigo-500",
    chip: "bg-slate-100 text-slate-700 border-slate-300",
    chipOn: "bg-indigo-100 text-indigo-800 border-indigo-300",
    input: "bg-white border-slate-300 text-slate-900 placeholder-slate-400",
    block: "bg-rose-200 border-rose-400 text-rose-900",
    progressBg: "bg-slate-200",
    progressFill: "bg-indigo-500",
    progressFillDone: "bg-emerald-500",
    semesterBg: "bg-slate-100",
  },
};

const CAL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const CAL_START = 8 * 60,
  CAL_END = 21 * 60;
const SLOT_MIN = 30,
  SLOT_PX = 22;
const SLOTS_PER_DAY = (CAL_END - CAL_START) / SLOT_MIN;
const HEADER_PX = 32,
  TIME_COL_PX = 56;
const DEFAULT_COURSE_COLOR = "#4F46E5";

const topPxFor = (m) => ((m - CAL_START) / SLOT_MIN) * SLOT_PX;
const heightPxFor = (s, e) => ((e - s) / SLOT_MIN) * SLOT_PX;
const uid = () => "id_" + Math.random().toString(36).slice(2, 9);

// ============================================================
// Component
// ============================================================
export default function ClassForge() {
  const [loaded, setLoaded] = useState(false);
  // Starts true (hidden) so the welcome never flashes before localStorage is read.
  const [welcomeDismissed, setWelcomeDismissed] = useState(true);
  const [welcomeReopened, setWelcomeReopened] = useState(false);
  // "idle" while saves to this browser succeed, "error" when storage is blocked or full.
  const [saveStatus, setSaveStatus] = useState("idle");

  // Persisted
  const [catalog, setCatalog] = useState(DEFAULT_USER_DATA.catalog);
  const [selectedCourseIds, setSelectedCourseIds] = useState(
    DEFAULT_USER_DATA.selected_courses,
  );
  const [enabledSections, setEnabledSections] = useState(
    DEFAULT_USER_DATA.enabled_sections,
  );
  const [blockedTimes, setBlockedTimes] = useState(
    DEFAULT_USER_DATA.blocked_times,
  );
  const [preferences, setPreferences] = useState(DEFAULT_USER_DATA.preferences);
  const [savedSchedules, setSavedSchedules] = useState(
    DEFAULT_USER_DATA.saved_schedules,
  );
  const [degreeTracker, setDegreeTracker] = useState(
    DEFAULT_USER_DATA.degree_tracker,
  );
  const [completedCourses, setCompletedCourses] = useState(
    DEFAULT_USER_DATA.completed_courses,
  );
  const [courseTags, setCourseTags] = useState(DEFAULT_USER_DATA.course_tags);
  const [courseColors, setCourseColors] = useState(
    DEFAULT_USER_DATA.course_colors,
  );

  // Ephemeral
  const [tab, setTab] = useState("builder");
  const [currentScheduleIdx, setCurrentScheduleIdx] = useState(0);
  const [previewSchedule, setPreviewSchedule] = useState(null);
  const [scheduleNameOpen, setScheduleNameOpen] = useState(false);
  const [scheduleNameInput, setScheduleNameInput] = useState("");
  const [parseStatus, setParseStatus] = useState(null);
  const [trackerStatus, setTrackerStatus] = useState(null);
  const [transcriptStatus, setTranscriptStatus] = useState(null);
  const [showSavedDropdown, setShowSavedDropdown] = useState(false);
  const [highlightCourseId, setHighlightCourseId] = useState(null); // for GPA-missing jump
  const [tutorialOpenFor, setTutorialOpenFor] = useState(null); // 'builder' | 'data' | 'record' | null
  const trackedStartRef = useRef(false);
  const trackedGenerationKeyRef = useRef(null);

  const theme = preferences.theme === "light" ? "light" : "dark";
  const t = T[theme];

  function currentUserDataSnapshot() {
    return {
      catalog,
      selected_courses: selectedCourseIds,
      enabled_sections: enabledSections,
      blocked_times: blockedTimes,
      preferences,
      saved_schedules: savedSchedules,
      degree_tracker: degreeTracker,
      completed_courses: completedCourses,
      course_tags: courseTags,
      course_colors: courseColors,
    };
  }

  function applyUserDataSnapshot(data) {
    setCatalog(data.catalog ?? DEFAULT_USER_DATA.catalog);
    setSelectedCourseIds(data.selected_courses ?? DEFAULT_USER_DATA.selected_courses);
    setEnabledSections(data.enabled_sections ?? DEFAULT_USER_DATA.enabled_sections);
    setBlockedTimes(data.blocked_times ?? DEFAULT_USER_DATA.blocked_times);
    setPreferences(data.preferences ?? DEFAULT_USER_DATA.preferences);
    setSavedSchedules(data.saved_schedules ?? DEFAULT_USER_DATA.saved_schedules);
    setDegreeTracker(data.degree_tracker ?? DEFAULT_USER_DATA.degree_tracker);
    setCompletedCourses(data.completed_courses ?? DEFAULT_USER_DATA.completed_courses);
    setCourseTags(data.course_tags ?? DEFAULT_USER_DATA.course_tags);
    setCourseColors(data.course_colors ?? DEFAULT_USER_DATA.course_colors);
  }

  // Apply body class so global CSS knows we're in the main app (which manages
  // its own scroll containers and doesn't want the page itself to scroll).
  // Info pages (/about, /contact, /privacy, /terms) don't have this class and
  // scroll normally.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("cf-app-shell");
    return () => {
      document.body.classList.remove("cf-app-shell");
    };
  }, []);

  useEffect(() => {
    setWelcomeDismissed(readWelcomeDismissed());
  }, []);

  // ---- Load: everything lives in this browser's localStorage ----
  useEffect(() => {
    const stored = loadLocalUserData();
    if (stored) applyUserDataSnapshot(stored);
    setLoaded(true);
  }, []);

  // ---- Save to this browser on every change ----
  useEffect(() => {
    if (!loaded) return;
    const ok = saveLocalUserData(currentUserDataSnapshot());
    setSaveStatus(ok ? "idle" : "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    catalog,
    selectedCourseIds,
    enabledSections,
    blockedTimes,
    preferences,
    savedSchedules,
    degreeTracker,
    completedCourses,
    courseTags,
    courseColors,
    loaded,
  ]);

  // ---- Derived ----
  const courseById = useMemo(
    () => new Map(catalog.map((c) => [c.id, c])),
    [catalog],
  );
  const selectedCourses = useMemo(
    () => selectedCourseIds.map((id) => courseById.get(id)).filter(Boolean),
    [selectedCourseIds, courseById],
  );
  const disabledSectionIds = useMemo(() => {
    const out = [];
    for (const c of selectedCourses) {
      const map = enabledSections[c.id] || {};
      for (const s of c.sections) if (map[s.id] === false) out.push(s.id);
    }
    return out;
  }, [selectedCourses, enabledSections]);

  const scheduleResult = useMemo(() => {
    if (!selectedCourses.length) return { schedules: [], reason: "idle" };
    return generateSchedules(selectedCourses, {
      blockedTimes,
      disabledSectionIds,
      maxResults: 200,
    });
  }, [selectedCourses, blockedTimes, disabledSectionIds]);
  const rankedSchedules = useMemo(
    () => rankSchedules(scheduleResult.schedules, preferences),
    [scheduleResult.schedules, preferences],
  );
  useEffect(() => {
    if (currentScheduleIdx >= rankedSchedules.length) setCurrentScheduleIdx(0);
  }, [rankedSchedules.length, currentScheduleIdx]);
  const currentSchedule = rankedSchedules[currentScheduleIdx] || null;
  const displaySchedule = previewSchedule || currentSchedule;

  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.appOpened, getUtmParams());
  }, []);

  useEffect(() => {
    if (trackedStartRef.current || selectedCourseIds.length === 0) return;
    trackedStartRef.current = true;
    trackEvent(ANALYTICS_EVENTS.scheduleBuilderStarted, {
      selected_course_count: selectedCourseIds.length,
      signed_in: false,
      ...getUtmParams(),
    });
  }, [selectedCourseIds.length]);

  useEffect(() => {
    if (scheduleResult.reason !== "ok" || rankedSchedules.length === 0) return;
    const key = selectedCourseIds.slice().sort().join("|") + ":" + rankedSchedules.length;
    if (trackedGenerationKeyRef.current === key) return;
    trackedGenerationKeyRef.current = key;
    trackEvent(ANALYTICS_EVENTS.scheduleGenerated, {
      selected_course_count: selectedCourseIds.length,
      schedule_count: rankedSchedules.length,
      signed_in: false,
      ...getUtmParams(),
    });
  }, [rankedSchedules.length, scheduleResult.reason, selectedCourseIds]);

  const projectedSelectedCourses = useMemo(() => {
    if (displaySchedule)
      return displaySchedule.sections.map((s) => ({
        code: s.courseCode,
        title: s.courseTitle,
        credits: s.credits,
      }));
    return selectedCourses.map((c) => ({
      code: c.code,
      title: c.title,
      credits: c.credits,
    }));
  }, [displaySchedule, selectedCourses]);

  const progress = useMemo(
    () =>
      computeProgress({
        tracker: degreeTracker,
        completedCourses,
        selectedCourses: projectedSelectedCourses,
        courseTags,
      }),
    [degreeTracker, completedCourses, projectedSelectedCourses, courseTags],
  );

  const gpa = useMemo(() => computeGPA(completedCourses), [completedCourses]);

  // ============================================================
  // Handlers
  // ============================================================
  function toggleTheme() {
    setPreferences((p) => ({
      ...p,
      theme: p.theme === "dark" ? "light" : "dark",
    }));
  }

  function toggleCourse(id) {
    setSelectedCourseIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
    setCurrentScheduleIdx(0);
  }
  function selectAllCourses() {
    setSelectedCourseIds(catalog.map((c) => c.id));
    setCurrentScheduleIdx(0);
  }
  function deselectAllCourses() {
    setSelectedCourseIds([]);
    setCurrentScheduleIdx(0);
  }
  function toggleSection(courseId, sectionId) {
    setEnabledSections((prev) => {
      const cur = prev[courseId] || {};
      return {
        ...prev,
        [courseId]: {
          ...cur,
          [sectionId]: cur[sectionId] === false ? true : false,
        },
      };
    });
    setCurrentScheduleIdx(0);
  }
  function clearAllBlocks() {
    setBlockedTimes([]);
  }

  function suggestScheduleName() {
    // Friendly default like "Spring 2026 Plan", numbered to be distinct
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    let term;
    if (month >= 9) term = "Spring " + (year + 1);
    else if (month >= 6) term = "Fall " + year;
    else if (month >= 3) term = "Fall " + year;
    else term = "Spring " + year;
    const base = term + " Plan";
    // Always number — even the FIRST save gets a number — so saves are visually distinct
    const existing = new Set(savedSchedules.map((s) => s.name).filter(Boolean));
    let i = 1;
    while (existing.has(base + " #" + i)) i++;
    return base + " #" + i;
  }

  function saveCurrentSchedule() {
    const scheduleToSave = displaySchedule || null;
    if (!scheduleToSave) return;
    const suggested = suggestScheduleName();
    setScheduleNameInput(suggested);
    setScheduleNameOpen(true);
  }

  function finalizeSave(name) {
    const scheduleToSave = displaySchedule || null;
    if (!scheduleToSave) {
      setScheduleNameOpen(false);
      return;
    }
    let id;
    try {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? "saved_" + crypto.randomUUID()
          : null;
    } catch (e) {
      id = null;
    }
    if (!id)
      id = "saved_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const stamp = new Date().toISOString();
    const finalName =
      (name || scheduleNameInput || "").trim() || suggestScheduleName();
    const snapshot = createScheduleSnapshot({
      id,
      savedAt: stamp,
      name: finalName,
      schedule: scheduleToSave,
      selectedCourseIds,
      enabledSections,
      blockedTimes,
    });
    try {
      console.debug("[finalizeSave] snapshot", snapshot);
    } catch (e) {}
    setSavedSchedules((prev) => [snapshot, ...prev]);
    trackEvent(ANALYTICS_EVENTS.scheduleSaved, {
      selected_course_count: selectedCourseIds.length,
      section_count: snapshot.sections.length,
      signed_in: false,
      ...getUtmParams(),
    });
    setScheduleNameOpen(false);
  }
  function deleteSavedSchedule(id) {
    setSavedSchedules((prev) => prev.filter((s) => s.id !== id));
  }
  function loadSavedSchedule(saved) {
    // Replace selection from the snapshot. The saved snapshot itself is not
    // mutated — we copy each field out.
    const restored = restoreScheduleSelection(saved, catalog);
    setSelectedCourseIds(restored.selectedCourseIds);
    setEnabledSections(restored.enabledSections);
    setBlockedTimes(restored.blockedTimes);
    setCurrentScheduleIdx(0);
    setTab("builder");
    setShowSavedDropdown(false);
    trackEvent(ANALYTICS_EVENTS.savedScheduleLoaded, {
      section_count: saved.sections?.length || 0,
      signed_in: false,
      ...getUtmParams(),
    });
  }

  function previewSavedSchedule(saved) {
    // Non-destructive preview: show this saved schedule without changing selections
    setPreviewSchedule({
      id: saved.id,
      name: saved.name,
      savedAt: saved.savedAt,
      sections: saved.sections || [],
    });
    setShowSavedDropdown(false);
    trackEvent(ANALYTICS_EVENTS.savedSchedulePreviewed, {
      section_count: saved.sections?.length || 0,
      signed_in: false,
      ...getUtmParams(),
    });
  }

  useEffect(() => {
    // Any user-driven change should clear the preview so the app returns to live results
    setPreviewSchedule(null);
  }, [selectedCourseIds, enabledSections]);

  // ----- Catalog -----
  async function handleCatalogFiles(files) {
    if (!files || !files.length) return;
    setParseStatus({ kind: "busy", text: "Parsing…" });
    const newCourses = [];
    for (const file of files) {
      try {
        const ext = file.name.toLowerCase().split(".").pop();
        const text =
          ext === "pdf" ? await extractTextFromPdf(file) : await file.text();
        const parsed = parseByFilename(file.name, text);
        for (const c of parsed) newCourses.push(c);
      } catch (e) {
        setParseStatus({
          kind: "error",
          text: "Failed to parse " + file.name + ": " + e.message,
        });
        return;
      }
    }
    if (!newCourses.length) {
      setParseStatus({
        kind: "error",
        text: "No courses found. Check the format guide below.",
      });
      return;
    }
    setCatalog((prev) => {
      const map = new Map(prev.map((c) => [c.code, c]));
      for (const c of newCourses) map.set(c.code, c);
      return Array.from(map.values());
    });
    setParseStatus({
      kind: "ok",
      text: `Imported ${newCourses.length} courses across ${files.length} file(s).`,
    });
  }
  // ----- First-visit welcome and sample data (guest mode only) -----
  const showWelcome =
    shouldShowWelcome({
      authChecked: true,
      loaded,
      signedIn: false,
      catalogLength: catalog.length,
      dismissed: welcomeDismissed,
    }) || welcomeReopened;
  function closeWelcome() {
    writeWelcomeDismissed();
    setWelcomeDismissed(true);
    setWelcomeReopened(false);
  }
  function loadSampleData() {
    applyUserDataSnapshot(applySampleData(currentUserDataSnapshot()));
    setCurrentScheduleIdx(0);
    setTab("builder");
    closeWelcome();
  }
  function clearSampleData() {
    applyUserDataSnapshot(stripSampleData(currentUserDataSnapshot()));
    setCurrentScheduleIdx(0);
  }
  function startWithOwnCourses() {
    closeWelcome();
    setTab("data");
  }
  const sampleLoaded = hasSampleData(catalog);

  function clearCatalog() {
    if (
      !confirm(
        "Clear your entire course catalog? This will also clear your selected courses.",
      )
    )
      return;
    setCatalog([]);
    setSelectedCourseIds([]);
    setEnabledSections({});
  }
  function addManualCourse(course) {
    setCatalog((prev) => {
      const without = prev.filter((c) => c.code !== course.code);
      return [
        ...without,
        {
          ...course,
          id: "c_" + course.code.replace(/[^a-z0-9]+/gi, "_").toLowerCase(),
          sections: course.sections.map((s, i) => ({
            ...s,
            id:
              "s_" +
              course.code.replace(/[^a-z0-9]+/gi, "_").toLowerCase() +
              "_" +
              i,
          })),
        },
      ];
    });
  }
  function removeCourseFromCatalog(courseId) {
    const c = catalog.find((x) => x.id === courseId);
    setCatalog((prev) => prev.filter((x) => x.id !== courseId));
    setSelectedCourseIds((prev) => prev.filter((id) => id !== courseId));
    if (c) {
      setCourseTags((prev) => {
        const n = { ...prev };
        delete n[c.code];
        return n;
      });
      setCourseColors((prev) => {
        const n = { ...prev };
        delete n[c.code];
        return n;
      });
    }
  }
  function setCourseColor(code, color) {
    setCourseColors((prev) => ({ ...prev, [code]: color }));
  }
  function clearCourseColor(code) {
    setCourseColors((prev) => {
      const n = { ...prev };
      delete n[code];
      return n;
    });
  }

  // ----- Tracker -----
  async function handleTrackerFiles(files) {
    if (!files || !files.length) return;
    setTrackerStatus({ kind: "busy", text: "Parsing degree audit…" });
    try {
      const file = files[0];
      const ext = file.name.toLowerCase().split(".").pop();
      const text =
        ext === "pdf" ? await extractTextFromPdf(file) : await file.text();
      const parsed = parseTrackerByFilename(file.name, text);
      if (!parsed.length) {
        setTrackerStatus({
          kind: "error",
          text: "Could not detect any requirements. Try the manual form below.",
        });
        return;
      }
      setDegreeTracker(parsed);
      setTrackerStatus({
        kind: "ok",
        text: `Imported ${parsed.length} requirements from ${file.name}.`,
      });
    } catch (e) {
      setTrackerStatus({
        kind: "error",
        text: "Failed to parse: " + e.message,
      });
    }
  }
  function addRequirement(name, credits, description) {
    if (!name || !credits || credits <= 0) return;
    const id =
      "req_" +
      name.replace(/[^a-z0-9]+/gi, "_").toLowerCase() +
      "_" +
      Date.now();
    setDegreeTracker((prev) => [
      ...prev,
      {
        id,
        name,
        credits: parseFloat(credits),
        description: description || "",
      },
    ]);
  }
  function updateRequirement(id, patch) {
    setDegreeTracker((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }
  function removeRequirement(id) {
    setDegreeTracker((prev) => prev.filter((r) => r.id !== id));
    // Remove this id from all multi-tag arrays
    setCourseTags((prev) => {
      const next = {};
      for (const [code, ids] of Object.entries(prev)) {
        const arr = Array.isArray(ids) ? ids : [ids];
        const filtered = arr.filter((x) => x && x !== id);
        if (filtered.length) next[code] = filtered;
      }
      return next;
    });
    setCompletedCourses((prev) =>
      prev.map((c) => {
        const tags = getTags(c).filter((x) => x !== id);
        return { ...c, requirementIds: tags, requirementId: undefined };
      }),
    );
  }
  function clearTracker() {
    if (!confirm("Clear your entire degree tracker?")) return;
    setDegreeTracker([]);
  }

  // ----- Completed courses -----
  function addCompleted(course) {
    setCompletedCourses((prev) => [
      {
        id: uid(),
        kind: "completed",
        requirementIds: course.requirementIds || [],
        ...course,
      },
      ...prev,
    ]);
  }
  function updateCompleted(id, patch) {
    setCompletedCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }
  function removeCompleted(id) {
    setCompletedCourses((prev) => prev.filter((c) => c.id !== id));
  }
  function moveCompletedToSemester(id, newSemester) {
    setCompletedCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, semester: newSemester } : c)),
    );
  }

  // ----- Transcript upload -----
  async function handleTranscriptFiles(files) {
    if (!files || !files.length) return;
    setTranscriptStatus({ kind: "busy", text: "Parsing transcript…" });
    try {
      const file = files[0];
      const ext = file.name.toLowerCase().split(".").pop();
      const text =
        ext === "pdf" ? await extractTextFromPdf(file) : await file.text();
      const parsed = parseTranscriptByFilename(file.name, text);
      if (!parsed.length) {
        setTranscriptStatus({
          kind: "error",
          text: "Could not detect any courses. Try CSV format or add manually.",
        });
        return;
      }
      // Merge with existing completed courses, deduping by code+semester
      setCompletedCourses((prev) => {
        const seen = new Set(
          prev
            .filter((c) => c.kind !== "forecast")
            .map((c) => c.code + "|" + (c.semester || "")),
        );
        const additions = [];
        for (const c of parsed) {
          const key = c.code + "|" + (c.semester || "");
          if (seen.has(key)) continue;
          additions.push({
            id: uid(),
            kind: "completed",
            requirementIds: [],
            code: c.code,
            title: c.title,
            credits: c.credits,
            grade: c.grade || "",
            semester: c.semester || "",
          });
          seen.add(key);
        }
        return [...additions, ...prev];
      });
      setTranscriptStatus({
        kind: "ok",
        text: `Imported ${parsed.length} courses from ${file.name}. Review and tag them below.`,
      });
    } catch (e) {
      setTranscriptStatus({
        kind: "error",
        text: "Failed to parse: " + e.message,
      });
    }
  }

  // ----- Forecast -----
  function generateForecastCourses() {
    // Builds placeholder forecast courses distributed across multiple semesters
    // using preferences.forecastOverloadCredits as the per-semester ceiling.
    const placeholders = generateForecastPlaceholders(progress.categories);
    if (!placeholders.length) {
      alert("All requirements are met or in progress. No forecasts needed!");
      return;
    }
    // Skip requirements that already have a forecast in the list
    const existingForecastReqs = new Set(
      completedCourses
        .filter((c) => c.kind === "forecast")
        .flatMap((c) => getTags(c)),
    );
    const remainingPlaceholders = placeholders.filter(
      (p) => !existingForecastReqs.has(p.requirementId),
    );
    if (!remainingPlaceholders.length) {
      alert(
        "Forecast placeholders already exist for all unfulfilled requirements.",
      );
      return;
    }
    // Determine starting semester: the most recent semester in the user's
    // completed courses, advanced one step. If none, use the next academic
    // semester from today.
    const completedSemesters = completedCourses
      .filter((c) => c.kind !== "forecast" && c.semester)
      .map((c) => c.semester);
    let startSemester;
    if (completedSemesters.length) {
      // Pick the latest one and advance
      const latest = completedSemesters.reduce((a, b) =>
        semesterSortKey(a) > semesterSortKey(b) ? a : b,
      );
      startSemester = nextAcademicSemester(latest) || latest;
    } else {
      const now = new Date();
      const month = now.getMonth();
      const year = now.getFullYear();
      if (month >= 9) startSemester = "Spring " + (year + 1);
      else if (month >= 3) startSemester = "Fall " + year;
      else startSemester = "Spring " + year;
    }
    const threshold = parseFloat(preferences.forecastOverloadCredits) || 18;
    const distributed = distributeForecastAcrossSemesters({
      placeholders: remainingPlaceholders,
      startSemester,
      threshold,
    });
    if (!distributed.length) {
      alert(
        'Could not distribute forecasts. Check that your starting semester format is recognized (e.g., "Fall 2025").',
      );
      return;
    }
    const additions = distributed.map((d) => ({
      id: uid(),
      kind: "forecast",
      code: "(planned)",
      title: d.requirementName,
      credits: d.credits,
      grade: "",
      semester: d.semester,
      requirementIds: [d.requirementId],
    }));
    setCompletedCourses((prev) => [...additions, ...prev]);
  }

  // ----- Tag handling (multi-tag) -----
  function setCourseTagsForCode(code, ids) {
    setCourseTags((prev) => {
      const next = { ...prev };
      const cleaned = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
      if (!cleaned.length) delete next[code];
      else next[code] = cleaned;
      return next;
    });
  }
  function setCompletedTags(id, ids) {
    setCompletedCourses((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              requirementIds: (Array.isArray(ids) ? ids : [ids]).filter(
                Boolean,
              ),
            }
          : c,
      ),
    );
  }

  return (
    <div
      className={
        "h-screen h-dvh w-screen flex flex-col overflow-hidden " +
        t.bg +
        " " +
        t.text
      }
    >
      <TopBar
        t={t}
        theme={theme}
        onToggleTheme={toggleTheme}
        saveStatus={saveStatus}
        tab={tab}
        setTab={setTab}
      />

      {saveStatus === "error" && (
        <div
          className={
            "border-b px-4 py-2 text-xs " +
            t.border +
            " " +
            (theme === "dark"
              ? "bg-sky-950/50 text-sky-100"
              : "bg-sky-50 text-sky-900")
          }
        >
          Could not save to this browser (storage may be blocked or full). Your changes will be lost when you close the page.
        </div>
      )}

      <main className="flex-1 min-h-0 flex items-stretch">
        {tab === "builder" && (
          <BuilderTab
            t={t}
            theme={theme}
            catalog={catalog}
            selectedCourseIds={selectedCourseIds}
            toggleCourse={toggleCourse}
            selectAllCourses={selectAllCourses}
            deselectAllCourses={deselectAllCourses}
            enabledSections={enabledSections}
            toggleSection={toggleSection}
            blockedTimes={blockedTimes}
            setBlockedTimes={setBlockedTimes}
            clearAllBlocks={clearAllBlocks}
            scheduleResult={scheduleResult}
            rankedSchedules={rankedSchedules}
            currentScheduleIdx={currentScheduleIdx}
            setCurrentScheduleIdx={setCurrentScheduleIdx}
            currentSchedule={displaySchedule}
            preferences={preferences}
            setPreferences={setPreferences}
            saveCurrentSchedule={saveCurrentSchedule}
            savedSchedules={savedSchedules}
            loadSavedSchedule={loadSavedSchedule}
            deleteSavedSchedule={deleteSavedSchedule}
            showSavedDropdown={showSavedDropdown}
            setShowSavedDropdown={setShowSavedDropdown}
            degreeTracker={degreeTracker}
            progress={progress}
            courseColors={courseColors}
            onOpenTutorial={() => setWelcomeReopened(true)}
            isGuest
            sampleLoaded={sampleLoaded}
            onTrySample={loadSampleData}
            onClearSample={clearSampleData}
            setTab={setTab}
          />
        )}
        {tab === "data" && (
          <DataTab
            t={t}
            theme={theme}
            catalog={catalog}
            handleFiles={handleCatalogFiles}
            parseStatus={parseStatus}
            clearCatalog={clearCatalog}
            savedSchedules={savedSchedules}
            loadSavedSchedule={loadSavedSchedule}
            deleteSavedSchedule={deleteSavedSchedule}
            addManualCourse={addManualCourse}
            removeCourseFromCatalog={removeCourseFromCatalog}
            degreeTracker={degreeTracker}
            progress={progress}
            courseTags={courseTags}
            setCourseTagsForCode={setCourseTagsForCode}
            courseColors={courseColors}
            setCourseColor={setCourseColor}
            clearCourseColor={clearCourseColor}
            setTab={setTab}
            isGuest
            sampleLoaded={sampleLoaded}
            onTrySample={loadSampleData}
            onClearSample={clearSampleData}
            onOpenTutorial={() => setTutorialOpenFor("data")}
          />
        )}
        {tab === "record" && (
          <MyRecordTab
            t={t}
            theme={theme}
            degreeTracker={degreeTracker}
            handleTrackerFiles={handleTrackerFiles}
            trackerStatus={trackerStatus}
            handleTranscriptFiles={handleTranscriptFiles}
            transcriptStatus={transcriptStatus}
            addRequirement={addRequirement}
            updateRequirement={updateRequirement}
            removeRequirement={removeRequirement}
            clearTracker={clearTracker}
            completedCourses={completedCourses}
            addCompleted={addCompleted}
            updateCompleted={updateCompleted}
            setCompletedTags={setCompletedTags}
            removeCompleted={removeCompleted}
            moveCompletedToSemester={moveCompletedToSemester}
            generateForecastCourses={generateForecastCourses}
            progress={progress}
            gpa={gpa}
            highlightCourseId={highlightCourseId}
            setHighlightCourseId={setHighlightCourseId}
            preferences={preferences}
            setPreferences={setPreferences}
            onOpenTutorial={() => setTutorialOpenFor("record")}
          />
        )}
      </main>

      <footer
        className={
          "border-t " +
          t.border +
          " px-6 py-3 text-xs " +
          t.textMute +
          " flex flex-wrap items-center justify-between gap-2"
        }
      >
        <div>© {new Date().getFullYear()} {BRAND.name}</div>
        <div className="flex gap-3">
          <a href="/about" className="hover:underline">
            About
          </a>
          <a href="/contact" className="hover:underline">
            Contact
          </a>
          <a href="/privacy" className="hover:underline">
            Privacy
          </a>
          <a href="/terms" className="hover:underline">
            Terms
          </a>
        </div>
      </footer>

      {scheduleNameOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setScheduleNameOpen(false)}
          />
          <div
            className={
              "z-50 p-4 rounded-lg w-96 border " + t.border + " " + t.panel
            }
          >
            <div className="text-sm font-medium mb-2">Name this schedule</div>
            <input
              type="text"
              value={scheduleNameInput}
              onChange={(e) => setScheduleNameInput(e.target.value)}
              className={"w-full p-2 rounded " + t.input + " " + t.border}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setScheduleNameOpen(false)}
                className={"px-3 py-1 rounded border " + t.border2}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => finalizeSave(scheduleNameInput)}
                className={"px-3 py-1 rounded text-white " + t.accentBg}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <WelcomeIntro
        t={t}
        theme={theme}
        open={showWelcome && tab === "builder"}
        isGuest
        onClose={closeWelcome}
        onTrySample={loadSampleData}
        onAddOwn={startWithOwnCourses}
        onOpenTutorial={() => {
          closeWelcome();
          setTutorialOpenFor("builder");
        }}
      />
      <Tutorial
        t={t}
        theme={theme}
        open={tutorialOpenFor !== null}
        onClose={() => setTutorialOpenFor(null)}
        title={tutorialOpenFor ? TUTORIALS[tutorialOpenFor].title : ""}
        steps={tutorialOpenFor ? TUTORIALS[tutorialOpenFor].steps : []}
      />
    </div>
  );
}

// ============================================================
// TopBar
// ============================================================
function TopBar({
  t,
  theme,
  onToggleTheme,
  saveStatus,
  tab,
  setTab,
}) {
  return (
    <header
      className={
        "flex items-center px-4 h-14 border-b " + t.border + " " + t.panel
      }
    >
      <div className="flex items-center gap-2 mr-6">
        <Image src={BRAND.assets.logoProfile} alt="" width={32} height={32} className="h-8 w-8 rounded-lg object-cover" />
        <div>
          <div className="text-lg font-bold leading-5">{BRAND.name}</div>
          <div className={"hidden text-[11px] leading-4 md:block " + t.textDim}>{BRAND.tagline}</div>
        </div>
      </div>
      <nav className="flex gap-1">
        {[
          ["builder", "Builder"],
          ["data", "Data Manager"],
          ["record", "My Record"],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " +
              (tab === k
                ? theme === "dark"
                  ? "bg-slate-800 text-sky-400"
                  : "bg-sky-100 text-sky-700"
                : theme === "dark"
                  ? "text-slate-400 hover:bg-slate-800/60"
                  : "text-slate-600 hover:bg-slate-100")
            }
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <span className={"text-xs " + t.textMute}>
          {saveStatus === "error" ? (
            <span className="text-rose-400">Not saved</span>
          ) : (
            <span title="No account needed: your data stays on this device.">
              Saved in this browser
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className={
            "rounded-md p-2 " +
            (theme === "dark" ? "hover:bg-slate-800" : "hover:bg-slate-100")
          }
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
        >
          {theme === "dark" ? "☀︎" : "☾"}
        </button>
      </div>
    </header>
  );
}

// ============================================================
// Builder tab
// ============================================================
function BuilderTab(props) {
  const {
    t,
    theme,
    catalog,
    selectedCourseIds,
    toggleCourse,
    selectAllCourses,
    deselectAllCourses,
    enabledSections,
    toggleSection,
    blockedTimes,
    setBlockedTimes,
    clearAllBlocks,
    scheduleResult,
    rankedSchedules,
    currentScheduleIdx,
    setCurrentScheduleIdx,
    currentSchedule,
    preferences,
    setPreferences,
    saveCurrentSchedule,
    savedSchedules,
    loadSavedSchedule,
    deleteSavedSchedule,
    showSavedDropdown,
    setShowSavedDropdown,
    degreeTracker,
    progress,
    courseColors,
    onOpenTutorial,
    isGuest,
    sampleLoaded,
    onTrySample,
    onClearSample,
    setTab,
  } = props;

  const showReq =
    preferences.showRequirementsOnBuilder !== false && degreeTracker.length > 0;
  const allSelected =
    catalog.length > 0 && selectedCourseIds.length === catalog.length;

  return (
    <>
      <aside className={"w-80 border-r " + t.border + " flex flex-col min-h-0"}>
        <div
          className={
            "px-4 py-3 border-b " +
            t.border +
            " flex items-center justify-between"
          }
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            Courses
          </h2>
          <span className={"text-xs " + t.textMute}>
            {catalog.length} in catalog
          </span>
        </div>
        {catalog.length > 0 && (
          <div className={"px-4 py-2 border-b " + t.border + " flex gap-2"}>
            <button
              type="button"
              onClick={() =>
                allSelected ? deselectAllCourses() : selectAllCourses()
              }
              className={
                "flex-1 text-xs px-2 py-1.5 rounded-md border " +
                t.border2 +
                " " +
                (theme === "dark" ? "hover:bg-slate-800" : "hover:bg-slate-100")
              }
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-auto cf-scroll">
          {!catalog.length && (
            <div className={"p-4 text-sm " + t.textDim}>
              <p className={"font-semibold mb-1 " + t.text}>
                Your course list is empty
              </p>
              <p className="mb-3">
                This is where you pick the classes you want this term.
                ClassForge then shows every schedule that fits with no time
                conflicts.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setTab("data")}
                  className={
                    "text-sm px-3 py-2 rounded-md font-semibold text-white " +
                    t.accentBg +
                    " " +
                    t.accentBgH
                  }
                >
                  Add my courses in Data Manager
                </button>
                {isGuest && (
                  <button
                    type="button"
                    onClick={onTrySample}
                    className={
                      "text-sm px-3 py-2 rounded-md border " +
                      t.border2 +
                      " " +
                      (theme === "dark"
                        ? "hover:bg-slate-800"
                        : "hover:bg-slate-100")
                    }
                  >
                    Try it with sample courses
                  </button>
                )}
              </div>
            </div>
          )}
          {catalog.map((c) => {
            const selected = selectedCourseIds.includes(c.id);
            const color = courseColors[c.code];
            return (
              <div
                key={c.id}
                className={
                  "border-b " +
                  t.border +
                  " px-4 py-3 cursor-pointer transition-colors " +
                  (selected
                    ? theme === "dark"
                      ? "bg-sky-950/40"
                      : "bg-sky-50"
                    : theme === "dark"
                      ? "hover:bg-slate-900/60"
                      : "hover:bg-slate-100")
                }
                onClick={() => toggleCourse(c.id)}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected}
                    readOnly
                    className="mt-1 accent-sky-500"
                  />
                  {color && (
                    <span
                      className="mt-1.5 w-3 h-3 rounded-sm shrink-0"
                      style={{ background: color }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{c.code}</span>
                      <span
                        className={
                          "text-[10px] uppercase tracking-wide " + t.textMute
                        }
                      >
                        {c.credits} cr
                      </span>
                      {isSampleCourse(c) && <SampleChip t={t} />}
                    </div>
                    <div className={"text-sm " + t.textDim + " truncate"}>
                      {c.title}
                    </div>
                  </div>
                </div>
                {selected && (
                  <div className="mt-2 ml-6 space-y-1">
                    {c.sections.map((s) => {
                      const enabledMap = enabledSections[c.id] || {};
                      const enabled = enabledMap[s.id] !== false;
                      return (
                        <button
                          type="button"
                          key={s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSection(c.id, s.id);
                          }}
                          className={
                            "w-full text-left text-xs px-2 py-1 rounded border transition-colors " +
                            (enabled
                              ? t.chipOn
                              : theme === "dark"
                                ? "bg-slate-800/50 border-slate-700 text-slate-500 line-through"
                                : "bg-slate-100 border-slate-300 text-slate-400 line-through")
                          }
                        >
                          §{s.section} ·{" "}
                          {s.meetings
                            .map(
                              (m) =>
                                m.days.join("") +
                                " " +
                                minutesToHHMM(m.start) +
                                "-" +
                                minutesToHHMM(m.end),
                            )
                            .join(" · ")}
                          {s.instructor && (
                            <span className={"ml-1 " + t.textMute}>
                              ({s.instructor})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <PrefsPanel
          t={t}
          theme={theme}
          preferences={preferences}
          setPreferences={setPreferences}
        />
      </aside>

      <section className="flex-1 min-h-0 flex flex-col">
        {sampleLoaded && isGuest && (
          <SampleBanner t={t} theme={theme} onClear={onClearSample} />
        )}
        <ScheduleBar
          t={t}
          theme={theme}
          rankedSchedules={rankedSchedules}
          currentScheduleIdx={currentScheduleIdx}
          setCurrentScheduleIdx={setCurrentScheduleIdx}
          scheduleResult={scheduleResult}
          saveCurrentSchedule={saveCurrentSchedule}
          blockedTimes={blockedTimes}
          clearAllBlocks={clearAllBlocks}
          savedSchedules={savedSchedules}
          loadSavedSchedule={loadSavedSchedule}
          deleteSavedSchedule={deleteSavedSchedule}
          showSavedDropdown={showSavedDropdown}
          setShowSavedDropdown={setShowSavedDropdown}
          showRequirementsHidden={!showReq && degreeTracker.length > 0}
          onShowRequirements={() =>
            setPreferences((p) => ({ ...p, showRequirementsOnBuilder: true }))
          }
          onOpenTutorial={onOpenTutorial}
        />
        <div className="flex-1 min-h-0 flex">
          <div
            className={
              "flex-1 min-w-0 min-h-0 flex flex-col " +
              (showReq ? "border-r " + t.border : "")
            }
          >
            <Calendar
              t={t}
              theme={theme}
              currentSchedule={currentSchedule}
              blockedTimes={blockedTimes}
              setBlockedTimes={setBlockedTimes}
              courseColors={courseColors}
            />
          </div>
          {showReq && (
            <RequirementsPanel
              t={t}
              theme={theme}
              progress={progress}
              setPreferences={setPreferences}
            />
          )}
        </div>
      </section>
    </>
  );
}

function PrefsPanel({ t, theme, preferences, setPreferences }) {
  function set(k, v) {
    setPreferences((p) => ({ ...p, [k]: v }));
  }
  const opts = [
    ["preferMornings", "Prefer mornings"],
    ["preferAfternoons", "Prefer afternoons"],
    ["preferDaysOff", "Prefer days off"],
    ["compactDays", "Compact days"],
  ];
  return (
    <div className={"border-t " + t.border + " p-3"}>
      <div className={"text-xs uppercase tracking-wide mb-2 " + t.textMute}>
        Preferences
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {opts.map(([k, label]) => (
          <button
            type="button"
            key={k}
            onClick={() => set(k, !preferences[k])}
            className={
              "text-xs px-2 py-1.5 rounded-md border transition-colors " +
              (preferences[k]
                ? t.chipOn
                : t.chip +
                  " " +
                  (theme === "dark"
                    ? "hover:bg-slate-700"
                    : "hover:bg-slate-200"))
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScheduleBar({
  t,
  theme,
  rankedSchedules,
  currentScheduleIdx,
  setCurrentScheduleIdx,
  scheduleResult,
  saveCurrentSchedule,
  blockedTimes,
  clearAllBlocks,
  savedSchedules,
  loadSavedSchedule,
  deleteSavedSchedule,
  showSavedDropdown,
  setShowSavedDropdown,
  showRequirementsHidden,
  onShowRequirements,
  onOpenTutorial,
}) {
  const total = rankedSchedules.length;
  return (
    <div
      className={
        "flex items-center gap-3 px-4 h-12 border-b " +
        t.border +
        " " +
        t.panel2 +
        " relative"
      }
    >
      <button
        type="button"
        disabled={!total || currentScheduleIdx === 0}
        onClick={() => setCurrentScheduleIdx((i) => Math.max(0, i - 1))}
        className={
          "px-2 py-1 rounded " +
          (theme === "dark" ? "hover:bg-slate-800" : "hover:bg-slate-100") +
          " disabled:opacity-30"
        }
      >
        ←
      </button>
      <div className="text-sm font-medium tabular-nums">
        {total ? `${currentScheduleIdx + 1} / ${total}` : "0 / 0"}
      </div>
      <button
        type="button"
        disabled={!total || currentScheduleIdx >= total - 1}
        onClick={() => setCurrentScheduleIdx((i) => Math.min(total - 1, i + 1))}
        className={
          "px-2 py-1 rounded " +
          (theme === "dark" ? "hover:bg-slate-800" : "hover:bg-slate-100") +
          " disabled:opacity-30"
        }
      >
        →
      </button>
      <div className={"text-xs " + t.textDim + " ml-2"}>
        {scheduleResult.reason === "no-courses" &&
          "Pick courses on the left to see schedules."}
        {scheduleResult.reason === "no-sections" && (
          <span className="text-rose-400">
            All sections of {scheduleResult.course?.code} are blocked or
            disabled.
          </span>
        )}
        {scheduleResult.reason === "no-valid-combination" && (
          <span className="text-amber-400">
            No conflict-free combination — try removing a course or unblocking
            time.
          </span>
        )}
        {scheduleResult.reason === "ok" &&
          total + " valid schedule" + (total === 1 ? "" : "s")}
      </div>
      <div className="flex-1" />

      {/* Saved schedules dropdown */}
      {showRequirementsHidden && (
        <button
          type="button"
          onClick={onShowRequirements}
          className={
            "text-xs px-3 py-1.5 rounded-md border " +
            t.border2 +
            " " +
            (theme === "dark" ? "hover:bg-slate-800" : "hover:bg-slate-100")
          }
          title="Show the requirements panel on the right"
        >
          Show requirements
        </button>
      )}

      {/* Saved schedules dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowSavedDropdown((v) => !v)}
          className={
            "text-xs px-3 py-1.5 rounded-md border " +
            t.border2 +
            " " +
            (theme === "dark" ? "hover:bg-slate-800" : "hover:bg-slate-100")
          }
        >
          Saved ({savedSchedules.length}) ▾
        </button>
        {showSavedDropdown && (
          <div
            className={
              "absolute right-0 top-full mt-1 w-80 rounded-lg border shadow-xl z-20 overflow-x-hidden " +
              t.border +
              " " +
              t.panel
            }
            onMouseLeave={() => setShowSavedDropdown(false)}
          >
            {!savedSchedules.length ? (
              <div className={"p-3 text-xs " + t.textDim}>
                No saved schedules yet.
              </div>
            ) : (
              <ul className="max-h-80 overflow-auto cf-scroll overflow-x-hidden">
                {savedSchedules.map((s) => (
                  <li
                    key={s.id}
                    className={
                      "px-3 py-2 border-b " +
                      t.border +
                      " flex items-center gap-2"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => previewSavedSchedule(s)}
                      className={
                        "flex-1 min-w-0 text-left " +
                        (theme === "dark"
                          ? "hover:bg-slate-800"
                          : "hover:bg-slate-50") +
                        " rounded p-1 -m-1"
                      }
                    >
                      <div className="text-sm font-medium truncate">
                        {s.name || s.savedAt}
                      </div>
                      <div
                        className={"text-[11px] " + t.textMute + " truncate"}
                      >
                        {s.sections
                          .slice(0, 4)
                          .map((sec) => sec.courseCode)
                          .join(" · ")}
                        {s.sections.length > 4 &&
                          " · +" + (s.sections.length - 4)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => loadSavedSchedule(s)}
                      title="Apply saved schedule"
                      className={
                        "text-xs px-2 py-0.5 rounded border mr-1 flex-shrink-0 " +
                        (theme === "dark"
                          ? "hover:bg-slate-800"
                          : "hover:bg-slate-50")
                      }
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSavedSchedule(s.id)}
                      className={
                        "text-xs px-1.5 py-0.5 rounded border border-rose-500/40 text-rose-400 flex-shrink-0 " +
                        (theme === "dark"
                          ? "hover:bg-rose-500/10"
                          : "hover:bg-rose-50")
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={clearAllBlocks}
        disabled={!blockedTimes.length}
        className={
          "text-xs px-2 py-1 rounded-md border " +
          t.border2 +
          " " +
          (theme === "dark" ? "hover:bg-slate-800" : "hover:bg-slate-100") +
          " disabled:opacity-40"
        }
      >
        Clear blocks
      </button>
      <button
        type="button"
        onClick={saveCurrentSchedule}
        disabled={!total}
        className={
          "text-xs px-3 py-1.5 rounded-md font-semibold text-white " +
          t.accentBg +
          " " +
          t.accentBgH +
          " disabled:opacity-40"
        }
      >
        Save schedule
      </button>
      {onOpenTutorial && (
        <HelpButton t={t} theme={theme} onClick={onOpenTutorial} />
      )}
    </div>
  );
}

function RequirementsPanel({ t, theme, progress, setPreferences }) {
  return (
    <aside className="w-80 flex flex-col min-h-0">
      <div
        className={
          "px-4 py-3 border-b " +
          t.border +
          " flex items-center justify-between"
        }
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Requirements
        </h2>
        <button
          type="button"
          onClick={() =>
            setPreferences((p) => ({ ...p, showRequirementsOnBuilder: false }))
          }
          className={
            "text-xs " +
            t.textMute +
            " " +
            (theme === "dark" ? "hover:text-slate-200" : "hover:text-slate-700")
          }
        >
          hide
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto cf-scroll p-3 space-y-3">
        <div className={"rounded-lg border p-3 " + t.border + " " + t.panel}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs uppercase tracking-wide opacity-70">
              Total credits
            </span>
            <span className="font-semibold">
              {progress.totals.completed +
                progress.totals.forecast +
                progress.totals.projected}
              {progress.totals.required ? " / " + progress.totals.required : ""}
            </span>
          </div>
          <div className={"text-[10px] " + t.textMute}>
            {progress.totals.completed} completed
            {progress.totals.forecast > 0 &&
              " · " + progress.totals.forecast + " planned"}
            {progress.totals.projected > 0 &&
              " · " + progress.totals.projected + " this term"}
          </div>
        </div>
        {progress.categories.map((cat) => (
          <ProgressBar key={cat.id} t={t} theme={theme} cat={cat} />
        ))}
        {progress.unallocated.completed +
          progress.unallocated.forecast +
          progress.unallocated.projected >
          0 && (
          <div
            className={
              "rounded-lg border p-3 " +
              t.border +
              " " +
              (theme === "dark" ? "bg-amber-500/5" : "bg-amber-50")
            }
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-medium">Unallocated</span>
              <span className="text-xs opacity-70">
                {progress.unallocated.completed +
                  progress.unallocated.forecast +
                  progress.unallocated.projected}{" "}
                cr
              </span>
            </div>
            <div className={"text-[10px] " + t.textMute}>
              Tag these in My Record to assign them.
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function ProgressBar({ t, theme, cat }) {
  const fill =
    cat.status === "complete" || cat.status === "over"
      ? t.progressFillDone
      : t.progressFill;
  const pct = Math.max(2, Math.min(100, cat.percent));
  return (
    <div className={"rounded-lg border p-3 " + t.border + " " + t.panel}>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-medium truncate">{cat.name}</span>
        <span className="text-xs tabular-nums">
          {cat.total} / {cat.required}
        </span>
      </div>
      <div className={"h-2 rounded-full overflow-hidden " + t.progressBg}>
        <div className={"h-full " + fill} style={{ width: pct + "%" }} />
      </div>
      <div className={"mt-1 text-[10px] " + t.textMute}>
        {cat.completed} completed
        {cat.forecast > 0 && " · " + cat.forecast + " planned"}
        {cat.projected > 0 && " · " + cat.projected + " this term"}
        {cat.status === "complete" && " · ✓ done"}
        {cat.status === "over" &&
          " · over by " + (cat.total - cat.required) + " cr"}
      </div>
    </div>
  );
}

// ============================================================
// Calendar
// ============================================================
function Calendar({
  t,
  theme,
  currentSchedule,
  blockedTimes,
  setBlockedTimes,
  courseColors,
}) {
  const gridRef = useRef(null);
  const [drag, setDrag] = useState(null);

  function slotFromEvent(e) {
    const rect = gridRef.current.getBoundingClientRect();
    const dayColWidth = (rect.width - TIME_COL_PX) / CAL_DAYS.length;
    const x = e.clientX - rect.left - TIME_COL_PX;
    const dayIdx = Math.max(
      0,
      Math.min(CAL_DAYS.length - 1, Math.floor(x / dayColWidth)),
    );
    const y = e.clientY - rect.top - HEADER_PX;
    const slot = Math.max(
      0,
      Math.min(SLOTS_PER_DAY - 1, Math.floor(y / SLOT_PX)),
    );
    return { day: CAL_DAYS[dayIdx], slot };
  }

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType !== "touch") return;
    if (!gridRef.current) return;
    e.preventDefault();
    gridRef.current.setPointerCapture?.(e.pointerId);
    const { day, slot } = slotFromEvent(e);
    if (slot < 0 || day === undefined) return;
    const existing = blockedTimes.find(
      (b) =>
        b.days.includes(day) &&
        slot * SLOT_MIN + CAL_START >= b.start &&
        slot * SLOT_MIN + CAL_START < b.end,
    );
    if (existing) {
      setBlockedTimes((prev) => prev.filter((x) => x !== existing));
      setDrag(null);
      return;
    }
    setDrag({ day, startSlot: slot, currentSlot: slot });
  }
  function onPointerMove(e) {
    if (!drag || !gridRef.current) return;
    const { day, slot } = slotFromEvent(e);
    if (day !== drag.day) return;
    setDrag((d) => (d ? { ...d, currentSlot: slot } : d));
  }
  function onPointerUp() {
    if (!drag) return;
    const a = Math.min(drag.startSlot, drag.currentSlot);
    const b = Math.max(drag.startSlot, drag.currentSlot);
    const start = CAL_START + a * SLOT_MIN;
    const end = CAL_START + (b + 1) * SLOT_MIN;
    setBlockedTimes((prev) => [...prev, { days: [drag.day], start, end }]);
    setDrag(null);
  }

  let previewRect = null;
  if (drag) {
    const a = Math.min(drag.startSlot, drag.currentSlot);
    const b = Math.max(drag.startSlot, drag.currentSlot);
    previewRect = {
      day: drag.day,
      top: a * SLOT_PX,
      height: (b - a + 1) * SLOT_PX,
    };
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto cf-scroll">
      <div
        ref={gridRef}
        className={
          "relative cf-no-select select-none mx-3 my-3 border " +
          t.border +
          " rounded-lg " +
          t.panel
        }
        style={{
          height: HEADER_PX + SLOTS_PER_DAY * SLOT_PX + 4,
          minWidth: TIME_COL_PX + CAL_DAYS.length * 120,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className={"absolute top-0 left-0 right-0 grid"}
          style={{
            height: HEADER_PX,
            gridTemplateColumns: `${TIME_COL_PX}px repeat(${CAL_DAYS.length}, 1fr)`,
          }}
        >
          <div className={"border-b border-r " + t.border}></div>
          {CAL_DAYS.map((d) => (
            <div
              key={d}
              className={
                "border-b " +
                t.border +
                " flex items-center justify-center text-xs font-semibold"
              }
            >
              {d}
            </div>
          ))}
        </div>
        <div
          className="absolute"
          style={{
            top: HEADER_PX,
            left: 0,
            width: TIME_COL_PX,
            height: SLOTS_PER_DAY * SLOT_PX,
          }}
        >
          {Array.from({ length: SLOTS_PER_DAY / 2 }).map((_, i) => {
            const min = CAL_START + i * 60;
            return (
              <div
                key={i}
                className={
                  "border-b " +
                  t.border +
                  " text-[10px] " +
                  t.textMute +
                  " pr-1 text-right"
                }
                style={{ height: SLOT_PX * 2 }}
              >
                {minutesToHHMM(min)}
              </div>
            );
          })}
        </div>
        <div
          className="absolute"
          style={{
            top: HEADER_PX,
            left: TIME_COL_PX,
            right: 0,
            height: SLOTS_PER_DAY * SLOT_PX,
            display: "grid",
            gridTemplateColumns: `repeat(${CAL_DAYS.length}, 1fr)`,
          }}
        >
          {CAL_DAYS.map((d) => (
            <div key={d} className={"relative border-l " + t.border}>
              {Array.from({ length: SLOTS_PER_DAY / 2 }).map((_, i) => (
                <div
                  key={i}
                  className={"border-b " + t.border}
                  style={{ height: SLOT_PX * 2 }}
                />
              ))}
              {blockedTimes
                .filter((b) => b.days.includes(d))
                .map((b, bi) => (
                  <div
                    key={bi}
                    className={
                      "absolute left-1 right-1 rounded-md border text-[10px] px-1 py-0.5 " +
                      t.block
                    }
                    style={{
                      top: topPxFor(b.start),
                      height: heightPxFor(b.start, b.end),
                    }}
                    title={
                      "Blocked: " +
                      minutesToHHMM(b.start) +
                      "–" +
                      minutesToHHMM(b.end)
                    }
                  >
                    {minutesToHHMM(b.start)}–{minutesToHHMM(b.end)}
                  </div>
                ))}
              {currentSchedule &&
                currentSchedule.sections.flatMap((sec) =>
                  sec.meetings
                    .filter((m) => m.days.includes(d))
                    .map((m, mi) => {
                      const color =
                        courseColors[sec.courseCode] || DEFAULT_COURSE_COLOR;
                      return (
                        <div
                          key={sec.id + ":" + d + ":" + mi}
                          className="absolute left-1 right-1 rounded-md border px-1 py-0.5 text-[11px] leading-tight"
                          style={{
                            top: topPxFor(m.start),
                            height: heightPxFor(m.start, m.end),
                            background: color + "4D", // ~30% alpha
                            borderColor: color,
                            color: theme === "dark" ? "#F1F5F9" : "#0F172A",
                          }}
                          title={
                            sec.courseCode +
                            " — " +
                            sec.courseTitle +
                            (sec.instructor ? " (" + sec.instructor + ")" : "")
                          }
                        >
                          <div className="font-semibold truncate">
                            {sec.courseCode}
                          </div>
                          <div className="truncate">
                            {minutesToHHMM(m.start)}–{minutesToHHMM(m.end)}
                          </div>
                        </div>
                      );
                    }),
                )}
              {previewRect && previewRect.day === d && (
                <div
                  className={
                    "absolute left-1 right-1 rounded-md border-2 border-dashed " +
                    (theme === "dark"
                      ? "bg-rose-500/20 border-rose-400/60"
                      : "bg-rose-200/60 border-rose-400")
                  }
                  style={{ top: previewRect.top, height: previewRect.height }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className={"mx-3 mb-3 text-xs " + t.textDim}>
        Click and drag on the calendar to block a time. Click an existing block
        to remove it.
      </div>
      <KeyboardBlockHelper
        t={t}
        theme={theme}
        setBlockedTimes={setBlockedTimes}
      />
    </div>
  );
}

function KeyboardBlockHelper({ t, theme, setBlockedTimes }) {
  const [day, setDay] = useState("Mon");
  const [start, setStart] = useState("9:00 AM");
  const [end, setEnd] = useState("10:00 AM");
  function add() {
    const s = parseTime(start);
    const e = parseTime(end);
    if (s === null || e === null || e <= s) {
      alert("Please enter a valid time range.");
      return;
    }
    setBlockedTimes((prev) => [...prev, { days: [day], start: s, end: e }]);
  }
  return (
    <div
      className={
        "mx-3 mb-3 p-3 rounded-lg border " +
        t.border +
        " " +
        t.panel +
        " flex flex-wrap items-center gap-2"
      }
    >
      <span className={"text-xs " + t.textMute + " mr-2"}>
        Add block by keyboard:
      </span>
      <select
        value={day}
        onChange={(e) => setDay(e.target.value)}
        className={"text-xs rounded border px-2 py-1 " + t.input}
      >
        {CAL_DAYS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <input
        value={start}
        onChange={(e) => setStart(e.target.value)}
        className={"text-xs rounded border px-2 py-1 w-24 " + t.input}
      />
      <span className={"text-xs " + t.textMute}>to</span>
      <input
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        className={"text-xs rounded border px-2 py-1 w-24 " + t.input}
      />
      <button
        type="button"
        onClick={add}
        className={
          "text-xs px-2 py-1 rounded-md border " +
          t.border2 +
          " " +
          (theme === "dark" ? "hover:bg-slate-800" : "hover:bg-slate-100")
        }
      >
        Add
      </button>
    </div>
  );
}

// ============================================================
// Data Manager tab
// ============================================================
function DataTab(props) {
  const {
    t,
    theme,
    catalog,
    handleFiles,
    parseStatus,
    clearCatalog,
    savedSchedules,
    loadSavedSchedule,
    deleteSavedSchedule,
    addManualCourse,
    removeCourseFromCatalog,
    degreeTracker,
    progress,
    courseTags,
    setCourseTagsForCode,
    courseColors,
    setCourseColor,
    clearCourseColor,
    setTab,
    onOpenTutorial,
    isGuest,
    sampleLoaded,
    onTrySample,
    onClearSample,
  } = props;

  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [showManual, setShowManual] = useState(false);

  return (
    <div className="flex-1 min-h-0 overflow-auto cf-scroll p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-1">
          <h1 className="text-2xl font-bold">Data Manager</h1>
          {onOpenTutorial && (
            <HelpButton t={t} theme={theme} onClick={onOpenTutorial} />
          )}
        </div>
        <p className={"text-sm mb-6 " + t.textDim}>
          Your course catalog lives here: the classes and section times you can
          choose from. Upload a catalog file or add courses manually, then open
          Builder to see every schedule that fits. Each course can be
          color-coded for the calendar.
        </p>
        {sampleLoaded && isGuest && (
          <div className="mb-4">
            <SampleBanner t={t} theme={theme} onClear={onClearSample} />
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={
            "rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors " +
            (dragOver
              ? theme === "dark"
                ? "border-sky-500 bg-sky-950/30"
                : "border-sky-500 bg-sky-50"
              : t.border + " " + t.panel)
          }
          onClick={() => inputRef.current?.click()}
        >
          <div className={"text-lg font-medium mb-2 " + t.text}>
            Drop a catalog file or click to browse
          </div>
          <div className={"text-xs " + t.textMute}>
            Supported: .csv, .tsv, .txt, .json, .pdf
          </div>
          <input
            type="file"
            ref={inputRef}
            multiple
            accept=".csv,.tsv,.txt,.json,.pdf"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
        </div>

        {parseStatus && (
          <div
            className={
              "mt-4 rounded-lg border px-4 py-3 text-sm " +
              (parseStatus.kind === "ok"
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : parseStatus.kind === "error"
                  ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                  : "border-sky-500/50 bg-sky-500/10 text-sky-300")
            }
          >
            {parseStatus.text}
          </div>
        )}

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className={"text-sm " + t.accent + " hover:underline"}
          >
            {showManual
              ? "− Hide manual course entry"
              : "+ Add a course manually"}
          </button>
        </div>
        {showManual && (
          <ManualCourseForm
            t={t}
            theme={theme}
            addManualCourse={addManualCourse}
          />
        )}

        {/* Catalog */}
        <div
          className={"mt-8 rounded-lg border p-4 " + t.border + " " + t.panel}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">
              Catalog ({catalog.length} courses)
            </h2>
            <button
              type="button"
              onClick={clearCatalog}
              disabled={!catalog.length}
              className={
                "text-xs px-2 py-1 rounded-md border " +
                t.border2 +
                " disabled:opacity-40 " +
                (theme === "dark" ? "hover:bg-slate-800" : "hover:bg-slate-100")
              }
            >
              Clear catalog
            </button>
          </div>
          {!catalog.length && (
            <div className={"text-sm " + t.textDim}>
              <p className="mb-2">
                No courses yet. Drop a catalog file above or add a course
                manually, then open Builder and pick the ones you want this
                term.
              </p>
              {isGuest && (
                <button
                  type="button"
                  onClick={onTrySample}
                  className={"text-sm " + t.accent + " hover:underline"}
                >
                  Or try it with sample courses
                </button>
              )}
            </div>
          )}
          <ul className="text-sm space-y-1 max-h-96 overflow-auto cf-scroll">
            {catalog.slice(0, 200).map((c) => (
              <CatalogRow
                key={c.id}
                t={t}
                theme={theme}
                course={c}
                color={courseColors[c.code]}
                tagIds={getCatalogTags(courseTags, c.code)}
                tracker={degreeTracker}
                onSetColor={(color) => setCourseColor(c.code, color)}
                onClearColor={() => clearCourseColor(c.code)}
                onSetTags={(ids) => setCourseTagsForCode(c.code, ids)}
                onRemove={() => removeCourseFromCatalog(c.id)}
              />
            ))}
          </ul>
          {catalog.length > 200 && (
            <div className={"mt-2 text-xs " + t.textMute}>
              (showing first 200)
            </div>
          )}
        </div>

        {/* Saved schedules */}
        <div
          className={"mt-6 rounded-lg border p-4 " + t.border + " " + t.panel}
        >
          <h2 className="font-semibold mb-3">Saved schedules</h2>
          {!savedSchedules.length && (
            <div className={"text-sm " + t.textDim}>
              None saved yet. In Builder, open a schedule you like and choose
              Save schedule. Saved schedules stay in this browser.
            </div>
          )}
          <ul className="space-y-2">
            {savedSchedules.map((s) => (
              <li
                key={s.id}
                className={
                  "flex items-center gap-3 rounded-md border p-2 " + t.border
                }
              >
                <button
                  type="button"
                  onClick={() => loadSavedSchedule(s)}
                  className={
                    "flex-1 text-left " +
                    (theme === "dark"
                      ? "hover:bg-slate-800/50"
                      : "hover:bg-slate-50") +
                    " rounded p-1 -m-1"
                  }
                >
                  <div className="text-sm font-medium">
                    {s.name || s.savedAt}
                  </div>
                  <div className={"text-xs " + t.textDim}>
                    {s.sections
                      .map((sec) => sec.courseCode + " §" + sec.section)
                      .join(" · ")}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => loadSavedSchedule(s)}
                  className={
                    "text-xs px-2 py-1 rounded-md text-white " +
                    t.accentBg +
                    " " +
                    t.accentBgH
                  }
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => deleteSavedSchedule(s.id)}
                  className={
                    "text-xs px-2 py-1 rounded-md border border-rose-500/50 text-rose-400 " +
                    (theme === "dark"
                      ? "hover:bg-rose-500/10"
                      : "hover:bg-rose-50")
                  }
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Degree progress summary */}
        {(degreeTracker.length > 0 || progress.totals.completed > 0) && (
          <div
            className={"mt-6 rounded-lg border p-4 " + t.border + " " + t.panel}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Degree progress</h2>
              <button
                type="button"
                onClick={() => setTab("record")}
                className={"text-xs " + t.accent + " hover:underline"}
              >
                Open My Record →
              </button>
            </div>
            {degreeTracker.length > 0 ? (
              <ul className="space-y-1.5">
                {progress.categories.slice(0, 6).map((cat) => (
                  <li key={cat.id} className="flex items-center gap-2 text-xs">
                    <span className="w-32 truncate">{cat.name}</span>
                    <div
                      className={
                        "flex-1 h-1.5 rounded-full overflow-hidden " +
                        t.progressBg
                      }
                    >
                      <div
                        className={
                          "h-full " +
                          (cat.status === "complete" || cat.status === "over"
                            ? t.progressFillDone
                            : t.progressFill)
                        }
                        style={{
                          width: Math.max(2, Math.min(100, cat.percent)) + "%",
                        }}
                      />
                    </div>
                    <span className="tabular-nums w-16 text-right">
                      {cat.total}/{cat.required}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={"text-sm " + t.textDim}>
                Set up your tracker in My Record.
              </div>
            )}
          </div>
        )}

        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold">Catalog file format</h2>
          <FormatGuideCard
            t={t}
            theme={theme}
            title="Catalog CSV"
            description="One row per section. Multiple sections of the same course = multiple rows."
            columns={[
              { name: "code", required: true },
              { name: "title", required: true },
              { name: "credits", required: true },
              { name: "section", required: true },
              { name: "days", required: true },
              { name: "time", required: true },
              { name: "instructor", required: false },
              { name: "location", required: false },
            ]}
            sample={`code,title,credits,section,days,time,instructor,location
CS 101,Intro to CS,3,001,MWF,9:00-9:50 AM,Smith,Room 100
CS 101,Intro to CS,3,002,TR,10:00-11:15 AM,Jones,Room 101
MATH 110,Calculus I,4,001,MWF,10:00-10:50 AM,Brown,Room 200`}
          />
        </div>
      </div>
    </div>
  );
}

function CatalogRow({
  t,
  theme,
  course,
  color,
  tagIds,
  tracker,
  onSetColor,
  onClearColor,
  onSetTags,
  onRemove,
}) {
  const [showTags, setShowTags] = useState(false);
  const tagNames = tagIds
    .map((id) => tracker.find((r) => r.id === id)?.name)
    .filter(Boolean);

  return (
    <li
      className={
        "flex items-center gap-2 py-1 px-1 rounded " +
        (theme === "dark" ? "hover:bg-slate-800/40" : "hover:bg-slate-50")
      }
    >
      <span className="font-mono w-20 shrink-0 text-xs">{course.code}</span>
      {isSampleCourse(course) && <SampleChip t={t} />}
      <span className={t.textDim + " truncate flex-1 text-xs"}>
        {course.title}
      </span>

      {/* Color picker */}
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={color || DEFAULT_COURSE_COLOR}
          onChange={(e) => onSetColor(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
          title="Pick a color"
          style={{ background: "transparent" }}
        />
        {color && (
          <button
            type="button"
            onClick={onClearColor}
            className={"text-[10px] " + t.textMute + " hover:text-rose-400"}
            title="Reset color"
          >
            ×
          </button>
        )}
      </div>

      {/* Multi-tag selector */}
      {tracker.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTags((v) => !v)}
            className={
              "text-[11px] px-2 py-0.5 rounded border " +
              (tagIds.length
                ? "bg-sky-500/20 text-sky-300 border-sky-700"
                : t.chip)
            }
          >
            {tagNames.length === 0
              ? "untagged"
              : tagNames.length === 1
                ? tagNames[0]
                : tagNames.length + " tags"}{" "}
            ▾
          </button>
          {showTags && (
            <div
              className={
                "absolute right-0 top-full mt-1 w-52 rounded-lg border shadow-xl z-10 " +
                t.border +
                " " +
                t.panel +
                " p-2"
              }
              onMouseLeave={() => setShowTags(false)}
            >
              {tracker.map((r) => {
                const on = tagIds.includes(r.id);
                return (
                  <label
                    key={r.id}
                    className={
                      "flex items-center gap-2 px-2 py-1 rounded cursor-pointer " +
                      (theme === "dark"
                        ? "hover:bg-slate-800"
                        : "hover:bg-slate-100")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        const next = on
                          ? tagIds.filter((x) => x !== r.id)
                          : [...tagIds, r.id];
                        onSetTags(next);
                      }}
                      className="accent-sky-500"
                    />
                    <span className="text-xs">{r.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      <span
        className={"text-[10px] " + t.textMute + " w-16 text-right shrink-0"}
      >
        {course.sections.length} sec
      </span>
      <button
        type="button"
        onClick={onRemove}
        className={
          "text-xs w-6 h-6 rounded border border-rose-500/40 text-rose-400 " +
          (theme === "dark" ? "hover:bg-rose-500/10" : "hover:bg-rose-50")
        }
        title="Remove from catalog"
      >
        ×
      </button>
    </li>
  );
}

function ManualCourseForm({ t, theme, addManualCourse }) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [credits, setCredits] = useState("3");
  const blank = () => ({
    section: "001",
    instructor: "",
    location: "",
    days: { Mon: false, Tue: false, Wed: false, Thu: false, Fri: false },
    start: "9:00 AM",
    end: "9:50 AM",
  });
  const [sections, setSections] = useState([blank()]);

  function updateSection(i, patch) {
    setSections((prev) =>
      prev.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    );
  }
  function toggleDay(i, d) {
    setSections((prev) =>
      prev.map((s, j) =>
        j === i ? { ...s, days: { ...s.days, [d]: !s.days[d] } } : s,
      ),
    );
  }
  function submit() {
    if (!code.trim() || !title.trim()) return alert("Code and title required.");
    const n = parseFloat(credits);
    if (!Number.isFinite(n) || n <= 0 || n > 12)
      return alert("Credits must be 1-12.");
    const built = [];
    for (const s of sections) {
      const days = Object.entries(s.days)
        .filter(([_, on]) => on)
        .map(([d]) => d);
      const sm = parseTime(s.start),
        em = parseTime(s.end);
      if (!days.length || sm === null || em === null || em <= sm) {
        return alert("Each section needs days and a valid time range.");
      }
      built.push({
        section: s.section || "001",
        instructor: s.instructor,
        location: s.location,
        meetings: [{ days, start: sm, end: em }],
      });
    }
    addManualCourse({
      code: code.trim().toUpperCase().replace(/\s+/g, " "),
      title: title.trim(),
      credits: n,
      sections: built,
    });
    setCode("");
    setTitle("");
    setCredits("3");
    setSections([blank()]);
  }

  return (
    <div className={"mt-3 rounded-lg border p-4 " + t.border + " " + t.panel}>
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-3">
          <label className={"block text-[11px] mb-1 " + t.textMute}>Code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CS 101"
            className={"w-full rounded border px-2 py-1 text-sm " + t.input}
          />
        </div>
        <div className="col-span-7">
          <label className={"block text-[11px] mb-1 " + t.textMute}>
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={"w-full rounded border px-2 py-1 text-sm " + t.input}
          />
        </div>
        <div className="col-span-2">
          <label className={"block text-[11px] mb-1 " + t.textMute}>
            Credits
          </label>
          <input
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            className={"w-full rounded border px-2 py-1 text-sm " + t.input}
          />
        </div>
      </div>
      <div className="mt-3">
        <div
          className={"text-xs uppercase tracking-wide " + t.textMute + " mb-2"}
        >
          Sections
        </div>
        {sections.map((s, i) => (
          <div key={i} className={"rounded border " + t.border + " p-3 mb-2"}>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-2">
                <label className={"block text-[11px] mb-1 " + t.textMute}>
                  Section
                </label>
                <input
                  value={s.section}
                  onChange={(e) =>
                    updateSection(i, { section: e.target.value })
                  }
                  className={
                    "w-full rounded border px-2 py-1 text-sm " + t.input
                  }
                />
              </div>
              <div className="col-span-5">
                <label className={"block text-[11px] mb-1 " + t.textMute}>
                  Instructor
                </label>
                <input
                  value={s.instructor}
                  onChange={(e) =>
                    updateSection(i, { instructor: e.target.value })
                  }
                  className={
                    "w-full rounded border px-2 py-1 text-sm " + t.input
                  }
                />
              </div>
              <div className="col-span-5">
                <label className={"block text-[11px] mb-1 " + t.textMute}>
                  Location
                </label>
                <input
                  value={s.location}
                  onChange={(e) =>
                    updateSection(i, { location: e.target.value })
                  }
                  className={
                    "w-full rounded border px-2 py-1 text-sm " + t.input
                  }
                />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className={"text-[11px] " + t.textMute + " mr-1"}>
                Days
              </span>
              {CAL_DAYS.map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => toggleDay(i, d)}
                  className={
                    "text-xs px-2 py-1 rounded border " +
                    (s.days[d] ? t.chipOn : t.chip)
                  }
                >
                  {d}
                </button>
              ))}
              <span className={"text-[11px] " + t.textMute + " mx-2"}>
                Time
              </span>
              <input
                value={s.start}
                onChange={(e) => updateSection(i, { start: e.target.value })}
                className={"text-xs rounded border px-2 py-1 w-24 " + t.input}
              />
              <span className={"text-[11px] " + t.textMute}>to</span>
              <input
                value={s.end}
                onChange={(e) => updateSection(i, { end: e.target.value })}
                className={"text-xs rounded border px-2 py-1 w-24 " + t.input}
              />
              {sections.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setSections((prev) => prev.filter((_, j) => j !== i))
                  }
                  className={
                    "text-xs px-2 py-1 rounded border border-rose-500/40 text-rose-400 ml-auto"
                  }
                >
                  Remove section
                </button>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setSections((prev) => [...prev, blank()])}
          className={"text-xs " + t.accent + " hover:underline"}
        >
          + Add another section
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          className={
            "text-sm px-4 py-1.5 rounded-md font-semibold text-white " +
            t.accentBg +
            " " +
            t.accentBgH
          }
        >
          Add to catalog
        </button>
      </div>
    </div>
  );
}

// ============================================================
// My Record tab
// ============================================================
function MyRecordTab(props) {
  const {
    t,
    theme,
    degreeTracker,
    handleTrackerFiles,
    trackerStatus,
    handleTranscriptFiles,
    transcriptStatus,
    addRequirement,
    updateRequirement,
    removeRequirement,
    clearTracker,
    completedCourses,
    addCompleted,
    updateCompleted,
    setCompletedTags,
    removeCompleted,
    moveCompletedToSemester,
    generateForecastCourses,
    progress,
    gpa,
    highlightCourseId,
    setHighlightCourseId,
    preferences,
    setPreferences,
    onOpenTutorial,
  } = props;

  const trackerInputRef = useRef(null);
  const transcriptInputRef = useRef(null);
  const [trackerDragOver, setTrackerDragOver] = useState(false);
  const [transcriptDragOver, setTranscriptDragOver] = useState(false);

  return (
    <div className="flex-1 min-h-0 overflow-auto cf-scroll p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between mb-1">
          <h1 className="text-2xl font-bold">My Record</h1>
          {onOpenTutorial && (
            <HelpButton t={t} theme={theme} onClick={onOpenTutorial} />
          )}
        </div>
        <p className={"text-sm mb-6 " + t.textDim}>
          Your degree record: add the requirements your degree needs and the
          courses you have finished, and ClassForge shows what is left and your
          GPA. This whole section is optional; scheduling works without it.
        </p>

        {/* GPA + total credit summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <GPACard
            t={t}
            theme={theme}
            gpa={gpa}
            highlightCourseId={highlightCourseId}
            setHighlightCourseId={setHighlightCourseId}
          />
          {degreeTracker.length > 0 && (
            <div
              className={"rounded-lg border p-4 " + t.border + " " + t.panel}
            >
              <div
                className={"text-xs uppercase tracking-wide mb-1 " + t.textMute}
              >
                Total credits
              </div>
              <div className="text-3xl font-bold">
                {progress.totals.completed +
                  progress.totals.forecast +
                  progress.totals.projected}
                <span className={"text-base ml-1 " + t.textDim}>
                  / {progress.totals.required}
                </span>
              </div>
              <div
                className={
                  "mt-2 h-2 rounded-full overflow-hidden " + t.progressBg
                }
              >
                <div
                  className={
                    "h-full " +
                    (progress.totals.completed +
                      progress.totals.forecast +
                      progress.totals.projected >=
                      progress.totals.required && progress.totals.required > 0
                      ? t.progressFillDone
                      : t.progressFill)
                  }
                  style={{
                    width:
                      progress.totals.required > 0
                        ? Math.max(
                            2,
                            Math.min(
                              100,
                              ((progress.totals.completed +
                                progress.totals.forecast +
                                progress.totals.projected) /
                                progress.totals.required) *
                                100,
                            ),
                          ) + "%"
                        : "0%",
                  }}
                />
              </div>
              <div className={"mt-2 text-xs " + t.textMute}>
                {progress.totals.completed} completed
                {progress.totals.forecast > 0 &&
                  " · " + progress.totals.forecast + " planned"}
                {progress.totals.projected > 0 &&
                  " · " + progress.totals.projected + " this term"}
              </div>
            </div>
          )}
        </div>

        {/* Tracker section */}
        <section className="mb-8">
          <h2 className="font-semibold mb-3">Degree tracker</h2>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setTrackerDragOver(true);
            }}
            onDragLeave={() => setTrackerDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setTrackerDragOver(false);
              handleTrackerFiles(e.dataTransfer.files);
            }}
            className={
              "rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors " +
              (trackerDragOver
                ? theme === "dark"
                  ? "border-sky-500 bg-sky-950/30"
                  : "border-sky-500 bg-sky-50"
                : t.border + " " + t.panel)
            }
            onClick={() => trackerInputRef.current?.click()}
          >
            <div className={"text-sm font-medium " + t.text}>
              Drop a degree audit or click to browse
            </div>
            <div className={"text-xs mt-1 " + t.textMute}>
              PDF, CSV, JSON, TXT
            </div>
            <input
              type="file"
              ref={trackerInputRef}
              accept=".csv,.tsv,.txt,.json,.pdf"
              onChange={(e) => {
                handleTrackerFiles(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
          </div>
          {trackerStatus && (
            <div
              className={
                "mt-3 rounded-lg border px-4 py-3 text-sm " +
                (trackerStatus.kind === "ok"
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                  : trackerStatus.kind === "error"
                    ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                    : "border-sky-500/50 bg-sky-500/10 text-sky-300")
              }
            >
              {trackerStatus.text}
            </div>
          )}

          <div
            className={"mt-4 rounded-lg border p-4 " + t.border + " " + t.panel}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">
                Requirements ({degreeTracker.length})
              </h3>
              {degreeTracker.length > 0 && (
                <button
                  type="button"
                  onClick={clearTracker}
                  className={
                    "text-xs px-2 py-1 rounded-md border " +
                    t.border2 +
                    " " +
                    (theme === "dark"
                      ? "hover:bg-slate-800"
                      : "hover:bg-slate-100")
                  }
                >
                  Clear all
                </button>
              )}
            </div>
            <RequirementForm t={t} theme={theme} onAdd={addRequirement} />
            {!degreeTracker.length && (
              <div className={"mt-3 text-sm " + t.textDim}>
                No requirements yet. Requirements are the credit categories your
                degree needs (for example core, major, electives). Upload a
                degree audit above or add one here and ClassForge tracks what
                is left.
              </div>
            )}
            <ul className="mt-3 space-y-2">
              {degreeTracker.map((req) => {
                const cat = progress.categories.find((c) => c.id === req.id);
                return (
                  <li key={req.id} className={"rounded border p-3 " + t.border}>
                    <RequirementRow
                      t={t}
                      theme={theme}
                      req={req}
                      cat={cat}
                      onUpdate={(p) => updateRequirement(req.id, p)}
                      onRemove={() => removeRequirement(req.id)}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Transcript upload */}
        <section className="mb-8">
          <h2 className="font-semibold mb-3">Completed courses</h2>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setTranscriptDragOver(true);
            }}
            onDragLeave={() => setTranscriptDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setTranscriptDragOver(false);
              handleTranscriptFiles(e.dataTransfer.files);
            }}
            className={
              "rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors " +
              (transcriptDragOver
                ? theme === "dark"
                  ? "border-emerald-500 bg-emerald-950/20"
                  : "border-emerald-500 bg-emerald-50"
                : t.border + " " + t.panel)
            }
            onClick={() => transcriptInputRef.current?.click()}
          >
            <div className={"text-sm font-medium " + t.text}>
              Drop a transcript or click to browse
            </div>
            <div className={"text-xs mt-1 " + t.textMute}>
              PDF, CSV, JSON, TXT — courses will be added below for review
            </div>
            <input
              type="file"
              ref={transcriptInputRef}
              accept=".csv,.tsv,.txt,.json,.pdf"
              onChange={(e) => {
                handleTranscriptFiles(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
          </div>
          {transcriptStatus && (
            <div
              className={
                "mt-3 rounded-lg border px-4 py-3 text-sm " +
                (transcriptStatus.kind === "ok"
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                  : transcriptStatus.kind === "error"
                    ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                    : "border-sky-500/50 bg-sky-500/10 text-sky-300")
              }
            >
              {transcriptStatus.text}
            </div>
          )}

          {/* Add manually */}
          <div
            className={"mt-4 rounded-lg border p-4 " + t.border + " " + t.panel}
          >
            <h3 className="text-sm font-semibold mb-3">
              Add a course manually
            </h3>
            <CompletedForm
              t={t}
              theme={theme}
              onAdd={addCompleted}
              tracker={degreeTracker}
            />
          </div>

          {/* Forecast generator + overload threshold */}
          {degreeTracker.length > 0 && (
            <div
              className={
                "mt-4 rounded-lg border p-3 " +
                t.border +
                " " +
                t.panel +
                " flex flex-wrap items-center gap-3"
              }
            >
              <button
                type="button"
                onClick={generateForecastCourses}
                className={
                  "text-sm px-3 py-1.5 rounded-md font-medium text-white " +
                  t.accentBg +
                  " " +
                  t.accentBgH
                }
              >
                + Forecast remaining requirements
              </button>
              <div className="flex items-center gap-2">
                <label className={"text-xs " + t.textDim}>Overload at:</label>
                <input
                  type="number"
                  min="3"
                  max="30"
                  step="1"
                  value={preferences.forecastOverloadCredits ?? 18}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (Number.isFinite(v) && v > 0) {
                      setPreferences((p) => ({
                        ...p,
                        forecastOverloadCredits: v,
                      }));
                    }
                  }}
                  className={"text-sm rounded border px-2 py-1 w-16 " + t.input}
                />
                <span className={"text-xs " + t.textMute}>
                  credits / semester
                </span>
              </div>
              <span
                className={"text-xs " + t.textMute + " flex-1 min-w-[200px]"}
              >
                Forecast spreads remaining requirements across future semesters.
                Semesters above the threshold show an &quot;overloaded&quot; tag.
              </span>
            </div>
          )}

          {/* Semester grid */}
          <SemesterGrid
            t={t}
            theme={theme}
            completedCourses={completedCourses}
            tracker={degreeTracker}
            updateCompleted={updateCompleted}
            setCompletedTags={setCompletedTags}
            removeCompleted={removeCompleted}
            moveCompletedToSemester={moveCompletedToSemester}
            highlightCourseId={highlightCourseId}
            overloadThreshold={preferences.forecastOverloadCredits ?? 18}
          />
        </section>

        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold">File formats</h2>
          <FormatGuideCard
            t={t}
            theme={theme}
            title="Degree tracker CSV"
            description="One row per requirement category. The app also accepts JSON, plain text ('Major: 45 credits'), or PDF where readable."
            columns={[
              { name: "name", required: true },
              { name: "credits", required: true },
              { name: "description", required: false },
            ]}
            sample={`name,credits,description
Major Core,45,Required for the major
General Education,30,
Free Electives,18,
Capstone,3,Senior project`}
          />
          <FormatGuideCard
            t={t}
            theme={theme}
            title="Transcript CSV"
            description="One row per completed course. The app also accepts plain text where it can detect 'Fall 2024' headers and 'CS 101 Intro to CS 3.00 A' style lines."
            columns={[
              { name: "code", required: true },
              { name: "title", required: true },
              { name: "credits", required: true },
              { name: "grade", required: false },
              { name: "semester", required: false },
            ]}
            sample={`code,title,credits,grade,semester
CS 101,Intro to CS,3,A,Fall 2024
MATH 110,Calc I,4,B+,Fall 2024
ENG 102,Comp,3,A-,Spring 2025
HIST 105,World History,3,P,Summer 2025`}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// GPA card
// ============================================================
function GPACard({ t, theme, gpa, highlightCourseId, setHighlightCourseId }) {
  return (
    <div className={"rounded-lg border p-4 " + t.border + " " + t.panel}>
      <div className={"text-xs uppercase tracking-wide mb-1 " + t.textMute}>
        GPA
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold tabular-nums">
          {gpa.gpa !== null ? gpa.gpa.toFixed(2) : "—"}
        </div>
        {gpa.missing.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setHighlightCourseId(gpa.missing[0].id);
              const el = document.getElementById(
                "completed-" + gpa.missing[0].id,
              );
              if (el)
                el.scrollIntoView({ behavior: "smooth", block: "center" });
              setTimeout(() => setHighlightCourseId(null), 3000);
            }}
            title={
              "Missing grade for: " +
              gpa.missing.map((m) => m.code).join(", ") +
              ". Click to find."
            }
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-500 text-white text-sm font-bold cursor-pointer hover:bg-rose-400"
          >
            !
          </button>
        )}
      </div>
      <div className={"mt-2 text-xs " + t.textMute}>
        {gpa.gradedCredits} credits graded · {gpa.totalCredits} total
        {gpa.missing.length > 0 && (
          <div className="text-rose-400 mt-1">
            ⚠ {gpa.missing.length} course{gpa.missing.length === 1 ? "" : "s"}{" "}
            missing grade — click ! to jump
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Semester grid (drag-and-drop)
// ============================================================
function SemesterGrid({
  t,
  theme,
  completedCourses,
  tracker,
  updateCompleted,
  setCompletedTags,
  removeCompleted,
  moveCompletedToSemester,
  highlightCourseId,
  overloadThreshold = 18,
}) {
  const groups = useMemo(
    () => groupCompletedBySemester(completedCourses),
    [completedCourses],
  );

  // Drop targets: each semester group + an "(unscheduled)" target if any forecast/no-semester present
  function onDragStart(e, courseId) {
    e.dataTransfer.setData("text/cf-course-id", courseId);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  function onDrop(e, semester) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/cf-course-id");
    if (id)
      moveCompletedToSemester(id, semester === "(no semester)" ? "" : semester);
  }

  if (!completedCourses.length) {
    return (
      <div
        className={
          "mt-4 rounded-lg border p-6 text-center text-sm " +
          t.border +
          " " +
          t.textDim
        }
      >
        No completed courses yet. Upload a transcript above or add a course by
        hand, and your credits, GPA and remaining requirements will appear
        here.
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => {
        const semCredits = group.courses.reduce(
          (a, c) => a + (parseFloat(c.credits) || 0),
          0,
        );
        const overloaded =
          semCredits > overloadThreshold && group.semester !== "(no semester)";
        return (
          <div
            key={group.semester}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, group.semester)}
            className={
              "rounded-lg border p-3 " +
              t.border +
              " " +
              t.semesterBg +
              " min-h-[120px]"
            }
          >
            <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">{group.semester}</h4>
                {overloaded && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 uppercase tracking-wide font-semibold"
                    title={`This semester has ${semCredits} credits, above your overload threshold of ${overloadThreshold}.`}
                  >
                    ⚠ overloaded
                  </span>
                )}
              </div>
              <span className={"text-xs " + t.textMute}>
                {group.courses.length}{" "}
                {group.courses.length === 1 ? "course" : "courses"} ·{" "}
                {semCredits} cr
              </span>
            </div>
            <div className="space-y-1.5">
              {group.courses.map((c) => (
                <SemesterCourseCard
                  key={c.id}
                  t={t}
                  theme={theme}
                  course={c}
                  tracker={tracker}
                  onDragStart={onDragStart}
                  onUpdate={(patch) => updateCompleted(c.id, patch)}
                  onSetTags={(ids) => setCompletedTags(c.id, ids)}
                  onRemove={() => removeCompleted(c.id)}
                  highlight={highlightCourseId === c.id}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SemesterCourseCard({
  t,
  theme,
  course,
  tracker,
  onDragStart,
  onUpdate,
  onSetTags,
  onRemove,
  highlight,
}) {
  const [editing, setEditing] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const tagIds = getTags(course);
  const tagNames = tagIds
    .map((id) => tracker.find((r) => r.id === id)?.name)
    .filter(Boolean);
  const isForecast = course.kind === "forecast";

  const cardStyle = {
    opacity: isForecast ? 0.7 : 1,
    borderStyle: isForecast ? "dashed" : "solid",
  };

  if (editing) {
    return (
      <div
        className={"rounded border p-2 " + t.border + " " + t.panel}
        style={cardStyle}
      >
        <CompletedRowEditor
          t={t}
          theme={theme}
          course={course}
          tracker={tracker}
          onSave={(patch) => {
            onUpdate(patch);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div
      id={"completed-" + course.id}
      draggable
      onDragStart={(e) => onDragStart(e, course.id)}
      className={
        "group rounded border p-2 cursor-grab active:cursor-grabbing transition-all " +
        (highlight ? "ring-2 ring-rose-500 " : "") +
        t.border +
        " " +
        t.panel
      }
      style={cardStyle}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-xs font-semibold">
              {course.code}
            </span>
            {isForecast && (
              <span className="text-[9px] uppercase tracking-wide text-amber-400">
                planned
              </span>
            )}
          </div>
          <div className={"text-xs " + t.textDim + " truncate"}>
            {course.title}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px]">
            <span className={t.textMute}>{course.credits} cr</span>
            {course.grade && (
              <span
                className={
                  "px-1.5 py-0 rounded " +
                  (course.grade.startsWith("A")
                    ? "bg-emerald-500/20 text-emerald-300"
                    : course.grade.startsWith("B")
                      ? "bg-sky-500/20 text-sky-300"
                      : course.grade.startsWith("C")
                        ? "bg-amber-500/20 text-amber-300"
                        : course.grade.startsWith("D")
                          ? "bg-orange-500/20 text-orange-300"
                          : course.grade === "F"
                            ? "bg-rose-500/20 text-rose-300"
                            : t.chip)
                }
              >
                {course.grade}
              </span>
            )}
            {!course.grade && !isForecast && (
              <span
                className="text-rose-400"
                title="Missing grade — required for GPA"
              >
                ⚠ no grade
              </span>
            )}
            {/* Tag pills */}
            {tagNames.slice(0, 2).map((name) => (
              <span
                key={name}
                className="px-1 py-0 rounded bg-sky-500/20 text-sky-300"
              >
                {name}
              </span>
            ))}
            {tagNames.length > 2 && (
              <span className={t.textMute}>+{tagNames.length - 2}</span>
            )}
            {tagNames.length === 0 && tracker.length > 0 && (
              <span className={t.textMute}>untagged</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {tracker.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTags((v) => !v)}
                className={
                  "text-[10px] px-1.5 py-0.5 rounded border " + t.border2
                }
                title="Edit tags"
              >
                tag
              </button>
              {showTags && (
                <div
                  className={
                    "absolute right-0 top-full mt-1 w-52 rounded-lg border shadow-xl z-10 " +
                    t.border +
                    " " +
                    t.panel +
                    " p-2"
                  }
                  onMouseLeave={() => setShowTags(false)}
                >
                  {tracker.map((r) => {
                    const on = tagIds.includes(r.id);
                    return (
                      <label
                        key={r.id}
                        className={
                          "flex items-center gap-2 px-2 py-1 rounded cursor-pointer " +
                          (theme === "dark"
                            ? "hover:bg-slate-800"
                            : "hover:bg-slate-100")
                        }
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            onSetTags(
                              on
                                ? tagIds.filter((x) => x !== r.id)
                                : [...tagIds, r.id],
                            );
                          }}
                          className="accent-sky-500"
                        />
                        <span className="text-xs">{r.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={"text-[10px] px-1.5 py-0.5 rounded border " + t.border2}
          >
            edit
          </button>
          <button
            type="button"
            onClick={onRemove}
            className={
              "text-[10px] w-5 h-5 rounded border border-rose-500/40 text-rose-400"
            }
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

function CompletedRowEditor({ t, theme, course, tracker, onSave, onCancel }) {
  const [code, setCode] = useState(course.code);
  const [title, setTitle] = useState(course.title || "");
  const [credits, setCredits] = useState(String(course.credits || 3));
  const [grade, setGrade] = useState(course.grade || "");
  const [semester, setSemester] = useState(course.semester || "");

  function save() {
    const n = parseFloat(credits);
    if (!code.trim() || !Number.isFinite(n) || n <= 0) return;
    onSave({
      code: code.trim().toUpperCase().replace(/\s+/g, " "),
      title: title.trim() || code.trim(),
      credits: n,
      grade: grade.trim().toUpperCase(),
      semester: semester.trim(),
    });
  }

  return (
    <div className="grid grid-cols-12 gap-1">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Code"
        className={"col-span-3 rounded border px-1.5 py-1 text-xs " + t.input}
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className={"col-span-9 rounded border px-1.5 py-1 text-xs " + t.input}
      />
      <input
        value={credits}
        onChange={(e) => setCredits(e.target.value)}
        placeholder="cr"
        className={"col-span-2 rounded border px-1.5 py-1 text-xs " + t.input}
      />
      <input
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
        placeholder="grade"
        className={"col-span-2 rounded border px-1.5 py-1 text-xs " + t.input}
      />
      <input
        value={semester}
        onChange={(e) => setSemester(e.target.value)}
        placeholder="semester"
        className={"col-span-5 rounded border px-1.5 py-1 text-xs " + t.input}
      />
      <button
        type="button"
        onClick={save}
        className={
          "col-span-2 text-xs rounded text-white " +
          t.accentBg +
          " " +
          t.accentBgH
        }
      >
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        className={"col-span-1 text-xs rounded border " + t.border2}
      >
        ×
      </button>
    </div>
  );
}

function CompletedForm({ t, theme, onAdd, tracker }) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [credits, setCredits] = useState("3");
  const [grade, setGrade] = useState("");
  const [semester, setSemester] = useState("");
  const [tagIds, setTagIds] = useState([]);

  function submit() {
    if (!code.trim()) return alert("Code required.");
    const n = parseFloat(credits);
    if (!Number.isFinite(n) || n <= 0)
      return alert("Credits must be positive.");
    onAdd({
      code: code.trim().toUpperCase().replace(/\s+/g, " "),
      title: title.trim() || code.trim(),
      credits: n,
      grade: grade.trim().toUpperCase(),
      semester: semester.trim(),
      requirementIds: tagIds,
    });
    setCode("");
    setTitle("");
    setCredits("3");
    setGrade("");
    setSemester("");
    setTagIds([]);
  }

  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-2">
        <label className={"block text-[11px] mb-1 " + t.textMute}>Code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="CS 101"
          className={"w-full rounded border px-2 py-1 text-sm " + t.input}
        />
      </div>
      <div className="col-span-3">
        <label className={"block text-[11px] mb-1 " + t.textMute}>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={"w-full rounded border px-2 py-1 text-sm " + t.input}
        />
      </div>
      <div className="col-span-1">
        <label className={"block text-[11px] mb-1 " + t.textMute}>Cr</label>
        <input
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          className={"w-full rounded border px-2 py-1 text-sm " + t.input}
        />
      </div>
      <div className="col-span-1">
        <label className={"block text-[11px] mb-1 " + t.textMute}>Grade</label>
        <input
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="A"
          className={"w-full rounded border px-2 py-1 text-sm " + t.input}
        />
      </div>
      <div className="col-span-2">
        <label className={"block text-[11px] mb-1 " + t.textMute}>
          Semester
        </label>
        <input
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
          placeholder="Fall 2024"
          className={"w-full rounded border px-2 py-1 text-sm " + t.input}
        />
      </div>
      <div className="col-span-2">
        <label className={"block text-[11px] mb-1 " + t.textMute}>Tags</label>
        {tracker.length === 0 ? (
          <div className={"text-[11px] " + t.textMute + " italic py-1.5"}>
            (no tracker)
          </div>
        ) : (
          <details className="relative">
            <summary
              className={
                "cursor-pointer text-xs px-2 py-1 rounded border " +
                t.border2 +
                " " +
                (theme === "dark" ? "bg-slate-800" : "bg-white")
              }
            >
              {tagIds.length === 0 ? "none" : tagIds.length + " selected"}
            </summary>
            <div
              className={
                "absolute right-0 top-full mt-1 w-52 rounded-lg border shadow-xl z-10 " +
                t.border +
                " " +
                t.panel +
                " p-2 max-h-48 overflow-y-auto"
              }
            >
              {tracker.map((r) => {
                const on = tagIds.includes(r.id);
                return (
                  <label
                    key={r.id}
                    className={
                      "flex items-center gap-2 px-1 py-1 rounded cursor-pointer " +
                      (theme === "dark"
                        ? "hover:bg-slate-800"
                        : "hover:bg-slate-100")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        setTagIds((prev) =>
                          on ? prev.filter((x) => x !== r.id) : [...prev, r.id],
                        );
                      }}
                      className="accent-sky-500"
                    />
                    <span className="text-xs">{r.name}</span>
                  </label>
                );
              })}
            </div>
          </details>
        )}
      </div>
      <div className="col-span-1">
        <button
          type="button"
          onClick={submit}
          className={
            "w-full text-sm px-2 py-1.5 rounded-md font-semibold text-white " +
            t.accentBg +
            " " +
            t.accentBgH
          }
        >
          +
        </button>
      </div>
    </div>
  );
}

function RequirementForm({ t, theme, onAdd }) {
  const [name, setName] = useState("");
  const [credits, setCredits] = useState("");
  const [desc, setDesc] = useState("");
  function submit() {
    if (!name.trim()) return alert("Name required.");
    const n = parseFloat(credits);
    if (!Number.isFinite(n) || n <= 0)
      return alert("Credits must be positive.");
    onAdd(name.trim(), n, desc.trim());
    setName("");
    setCredits("");
    setDesc("");
  }
  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-4">
        <label className={"block text-[11px] mb-1 " + t.textMute}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Major Core"
          className={"w-full rounded border px-2 py-1 text-sm " + t.input}
        />
      </div>
      <div className="col-span-2">
        <label className={"block text-[11px] mb-1 " + t.textMute}>
          Credits
        </label>
        <input
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          placeholder="45"
          className={"w-full rounded border px-2 py-1 text-sm " + t.input}
        />
      </div>
      <div className="col-span-4">
        <label className={"block text-[11px] mb-1 " + t.textMute}>
          Description (optional)
        </label>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className={"w-full rounded border px-2 py-1 text-sm " + t.input}
        />
      </div>
      <div className="col-span-2">
        <button
          type="button"
          onClick={submit}
          className={
            "w-full text-sm px-3 py-1.5 rounded-md font-semibold text-white " +
            t.accentBg +
            " " +
            t.accentBgH
          }
        >
          + Add
        </button>
      </div>
    </div>
  );
}

function RequirementRow({ t, theme, req, cat, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(req.name);
  const [credits, setCredits] = useState(String(req.credits));
  const [desc, setDesc] = useState(req.description || "");
  function save() {
    const n = parseFloat(credits);
    if (!name.trim() || !Number.isFinite(n) || n <= 0) return;
    onUpdate({ name: name.trim(), credits: n, description: desc.trim() });
    setEditing(false);
  }
  if (editing) {
    return (
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={"w-full rounded border px-2 py-1 text-sm " + t.input}
          />
        </div>
        <div className="col-span-2">
          <input
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            className={"w-full rounded border px-2 py-1 text-sm " + t.input}
          />
        </div>
        <div className="col-span-4">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className={"w-full rounded border px-2 py-1 text-sm " + t.input}
          />
        </div>
        <div className="col-span-2 flex gap-1">
          <button
            type="button"
            onClick={save}
            className={
              "flex-1 text-xs px-2 py-1 rounded text-white " +
              t.accentBg +
              " " +
              t.accentBgH
            }
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className={"flex-1 text-xs px-2 py-1 rounded border " + t.border2}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{req.name}</span>
          <span className={"text-xs " + t.textMute}>{req.credits} cr</span>
          {cat && (cat.status === "complete" || cat.status === "over") && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              complete
            </span>
          )}
        </div>
        {req.description && (
          <div className={"text-xs " + t.textDim}>{req.description}</div>
        )}
        {cat && (
          <div className="mt-1 flex items-center gap-2">
            <div
              className={
                "flex-1 h-1.5 rounded-full overflow-hidden " + t.progressBg
              }
            >
              <div
                className={
                  "h-full " +
                  (cat.status === "complete" || cat.status === "over"
                    ? t.progressFillDone
                    : t.progressFill)
                }
                style={{ width: Math.max(2, Math.min(100, cat.percent)) + "%" }}
              />
            </div>
            <span className="text-[11px] tabular-nums">
              {cat.total}/{cat.required}
            </span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={
          "text-xs px-2 py-1 rounded border " +
          t.border2 +
          " " +
          (theme === "dark" ? "hover:bg-slate-800" : "hover:bg-slate-100")
        }
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onRemove}
        className={
          "text-xs px-2 py-1 rounded border border-rose-500/40 text-rose-400"
        }
      >
        Delete
      </button>
    </div>
  );
}

// ============================================================
// First-visit welcome + sample-data pieces
// ============================================================
function SampleChip({ t }) {
  return (
    <span
      className={
        "text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0 " +
        t.chipOn
      }
    >
      Sample
    </span>
  );
}

function SampleBanner({ t, theme, onClear }) {
  return (
    <div
      role="status"
      className={
        "flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs border-b " +
        (theme === "dark"
          ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
          : "bg-amber-50 border-amber-300 text-amber-900")
      }
    >
      <span className="flex-1 min-w-0">
        <strong>Sample data.</strong> These are fictional courses so you can see
        how ClassForge works. Clear them when you are ready to add your own.
      </span>
      <button
        type="button"
        onClick={onClear}
        className={
          "px-2.5 py-1 rounded-md border font-semibold " +
          (theme === "dark"
            ? "border-amber-400/50 hover:bg-amber-500/20"
            : "border-amber-500 hover:bg-amber-100")
        }
      >
        Clear sample data
      </button>
    </div>
  );
}

const WELCOME_STEPS = [
  {
    title: "Add your courses",
    body: "Upload your school's catalog or type courses in by hand.",
  },
  {
    title: "Block your busy times",
    body: "Drag on the calendar to mark work, practice or anything else.",
  },
  {
    title: "Pick a schedule that fits",
    body: "Flip through every combination with no time conflicts and save the one you like.",
  },
];

function WelcomeIntro({
  t,
  theme,
  open,
  isGuest,
  onClose,
  onTrySample,
  onAddOwn,
  onOpenTutorial,
}) {
  const dialogRef = useRef(null);
  const primaryRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    primaryRef.current?.focus();
    return () => {
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll(
      'button, a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || !focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cf-welcome-title"
        aria-describedby="cf-welcome-desc"
        className={
          "rounded-xl border shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto " +
          t.border +
          " " +
          t.panel
        }
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <div className={"text-xs font-semibold uppercase tracking-wide " + t.accent}>
              Welcome to {BRAND.name}
            </div>
            <h2
              id="cf-welcome-title"
              className="mt-1 text-xl sm:text-2xl font-bold leading-snug"
            >
              Build a conflict-free class schedule in minutes
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close welcome"
            className={
              "text-2xl leading-none px-2 -mr-2 rounded " +
              t.textDim +
              " " +
              (theme === "dark"
                ? "hover:text-slate-100"
                : "hover:text-slate-900")
            }
          >
            ×
          </button>
        </div>
        <p
          id="cf-welcome-desc"
          className={"px-5 mt-2 text-sm leading-relaxed " + t.textDim}
        >
          Tell {BRAND.name} which courses you need and when you are busy, and it
          shows every schedule that fits with no time conflicts.
        </p>
        <ol className="px-5 mt-4 space-y-3">
          {WELCOME_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className={
                  "shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white " +
                  t.accentBg
                }
              >
                {i + 1}
              </span>
              <div>
                <div className="font-semibold text-sm">{step.title}</div>
                <div className={"text-sm " + t.textDim}>{step.body}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="px-5 mt-5 flex flex-col sm:flex-row gap-2">
          {isGuest ? (
            <>
              <button
                type="button"
                ref={primaryRef}
                onClick={onTrySample}
                className={
                  "flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white " +
                  t.accentBg +
                  " " +
                  t.accentBgH
                }
              >
                Try it with sample courses
              </button>
              <button
                type="button"
                onClick={onAddOwn}
                className={
                  "flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border " +
                  t.border2 +
                  " " +
                  (theme === "dark"
                    ? "hover:bg-slate-800"
                    : "hover:bg-slate-100")
                }
              >
                Add my own courses
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                ref={primaryRef}
                onClick={onAddOwn}
                className={
                  "flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white " +
                  t.accentBg +
                  " " +
                  t.accentBgH
                }
              >
                Add my courses in Data Manager
              </button>
              <button
                type="button"
                onClick={onClose}
                className={
                  "flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border " +
                  t.border2 +
                  " " +
                  (theme === "dark"
                    ? "hover:bg-slate-800"
                    : "hover:bg-slate-100")
                }
              >
                Close
              </button>
            </>
          )}
        </div>
        <div
          className={
            "px-5 py-4 mt-1 text-xs leading-relaxed flex flex-wrap items-center justify-between gap-x-4 gap-y-1 " +
            t.textDim
          }
        >
          <span>
            {isGuest
              ? "No sign-in needed. Everything you add stays in this browser. Sample courses are fictional."
              : "Reopen this any time from the ? button in Builder."}
          </span>
          <button
            type="button"
            onClick={onOpenTutorial}
            className={"underline " + t.accent}
          >
            Full Builder tutorial
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Help button + Tutorial overlay
// ============================================================
function HelpButton({ t, theme, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="About this tab"
      aria-label="About this tab"
      className={
        "inline-flex items-center justify-center w-7 h-7 rounded-full border text-sm font-bold transition-colors " +
        t.border2 +
        " " +
        (theme === "dark"
          ? "hover:bg-slate-800 text-slate-300"
          : "hover:bg-slate-100 text-slate-600")
      }
    >
      ?
    </button>
  );
}

function Tutorial({ t, theme, open, onClose, title, steps }) {
  const [stepIdx, setStepIdx] = useState(0);
  // Reset to step 0 whenever we open OR when the steps array swaps (different tab)
  useEffect(() => {
    if (open) setStepIdx(0);
  }, [open, steps]);

  if (!open) return null;
  if (!steps || steps.length === 0) return null;
  // Clamp defensively in case stepIdx is stale on the first render after a steps swap
  const safeIdx = Math.min(Math.max(0, stepIdx), steps.length - 1);
  const step = steps[safeIdx];
  const isLast = safeIdx === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={
          "rounded-xl border shadow-2xl max-w-lg w-full " +
          t.border +
          " " +
          t.panel
        }
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className={
            "px-5 py-3 border-b " +
            t.border +
            " flex items-center justify-between"
          }
        >
          <div className="flex items-center gap-2">
            <span className={"text-xs px-2 py-0.5 rounded " + t.chipOn}>
              Tutorial
            </span>
            <h3 className="font-semibold">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tutorial"
            className={
              "text-lg " +
              t.textMute +
              " " +
              (theme === "dark"
                ? "hover:text-slate-200"
                : "hover:text-slate-700")
            }
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">
          <div className={"text-xs uppercase tracking-wide mb-2 " + t.textMute}>
            Step {safeIdx + 1} of {steps.length}
          </div>
          <div className="text-base font-medium mb-2">{step.heading}</div>
          <div
            className={
              "text-sm leading-relaxed " + t.textDim + " whitespace-pre-line"
            }
          >
            {step.body}
          </div>
        </div>
        <div
          className={
            "px-5 py-3 border-t " +
            t.border +
            " flex items-center justify-between gap-2"
          }
        >
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={
                  "w-2 h-2 rounded-full transition-colors " +
                  (i === safeIdx
                    ? t.accentBg
                    : theme === "dark"
                      ? "bg-slate-700"
                      : "bg-slate-300")
                }
              />
            ))}
          </div>
          <div className="flex gap-2">
            {safeIdx > 0 && (
              <button
                type="button"
                onClick={() => setStepIdx(safeIdx - 1)}
                className={
                  "text-sm px-3 py-1.5 rounded-md border " +
                  t.border2 +
                  " " +
                  (theme === "dark"
                    ? "hover:bg-slate-800"
                    : "hover:bg-slate-100")
                }
              >
                Back
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                onClick={() => setStepIdx(safeIdx + 1)}
                className={
                  "text-sm px-3 py-1.5 rounded-md font-semibold text-white " +
                  t.accentBg +
                  " " +
                  t.accentBgH
                }
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className={
                  "text-sm px-3 py-1.5 rounded-md font-semibold text-white " +
                  t.accentBg +
                  " " +
                  t.accentBgH
                }
              >
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const TUTORIALS = {
  builder: {
    title: "Builder — your weekly schedule",
    steps: [
      {
        heading: "Pick courses on the left",
        body: 'The left sidebar shows every course in your catalog. Click one to add it to this term. The "Select all" button at the top adds them all at once — useful when you want to see every possible combination.',
      },
      {
        heading: "See valid schedules in the middle",
        body: "ClassForge generates every conflict-free combination of sections from your selected courses. Use the ← / → arrows in the top bar to flip through them. The number shows your current schedule out of the total found.",
      },
      {
        heading: "Block out times you can't attend",
        body: "Click and drag on the calendar to mark a time as unavailable (work shift, athletics, etc.). The schedule generator treats these as hard constraints and excludes any section that overlaps them. Click an existing block to remove it.",
      },
      {
        heading: "Fine-tune section preferences",
        body: "When a course is selected, its sections appear underneath. Click a section pill to disable it — that section won't be considered. Use this to remove specific instructors or time slots without removing the whole course.",
      },
      {
        heading: "Save schedules you like",
        body: 'Click "Save schedule" to keep a snapshot. Saved schedules show up in the "Saved (N) ▾" dropdown at the top — click any one to instantly load it back into the calendar. Loading replaces your current selection.',
      },
      {
        heading: "Track your degree progress",
        body: 'If you\'ve set up a degree tracker on the My Record tab, the panel on the right shows live progress for each requirement — including credits this term. Click "hide" if you need more space; a "Show requirements" button appears in the top bar to bring it back.',
      },
    ],
  },
  data: {
    title: "Data Manager — catalog & saved schedules",
    steps: [
      {
        heading: "Upload a course catalog",
        body: "Drop a CSV, TSV, JSON, or PDF file with your school's course offerings. The format guide at the bottom shows exactly what columns are required. Your catalog stays in this browser; it is never uploaded.",
      },
      {
        heading: "Add courses manually",
        body: 'Click "+ Add a course manually" if your catalog isn\'t in a parseable format, or to add a single course. Set days, time, instructor, and create multiple sections per course.',
      },
      {
        heading: "Color-code your courses",
        body: "Each row in the catalog has a color picker. Whatever color you pick shows on the calendar blocks AND as a small swatch next to the course name in the Builder sidebar. Click the × next to the swatch to reset to the default color.",
      },
      {
        heading: "Tag courses for requirements",
        body: "When you have a degree tracker set up, each catalog course shows a tag dropdown. Check one or more requirements to mark which categories that course satisfies — multi-tagging lets one course count for multiple buckets.",
      },
      {
        heading: "Reload saved schedules from here",
        body: 'The "Saved schedules" section lists every schedule you\'ve saved on the Builder tab. Click any row, or the Load button, to restore that schedule and switch to the Builder.',
      },
    ],
  },
  record: {
    title: "My Record — degree tracker, GPA, planning",
    steps: [
      {
        heading: "GPA at the top",
        body: "Your GPA auto-calculates from grades on completed courses. P (pass-fail), W (withdrawn), and forecasted/planned courses are excluded. If a course is missing a grade, a red ! button appears — click it to jump to the missing course.",
      },
      {
        heading: "Set up your degree tracker",
        body: 'Either drop a degree audit file (CSV/JSON/text/PDF) or add requirements one at a time using the form. Each requirement has a name and a credit total — for example, "Major Core, 45 credits." This is the spine of everything else on this tab.',
      },
      {
        heading: "Log completed courses three ways",
        body: "Drop a transcript file to bulk-import courses with grades and semesters. Or add courses one at a time using the manual form. Or upload, then edit individual cards to fix anything the parser got wrong.",
      },
      {
        heading: "Courses group by semester automatically",
        body: 'Type "Fall 2024" in the semester field and that course slots into the Fall 2024 column. Semesters sort chronologically: Winter < Spring < Summer < Fall. Drag any card between columns to move it to a different semester.',
      },
      {
        heading: "Multi-tag for double-counting",
        body: "Click \"tag\" on any course card and check multiple requirements. The course's credits count toward each tagged requirement's progress bar — but only once toward your degree total. Useful when a single course satisfies both Major Core AND Math Sequence, for example.",
      },
      {
        heading: "Forecast remaining requirements",
        body: 'Click "Forecast remaining requirements" to fill in placeholder cards for everything you still need to take. ClassForge spreads them across future semesters using the overload threshold you set (default 18 credits/sem). The cards appear with a dashed border and lighter shade so you can tell plans from completed courses.',
      },
      {
        heading: "Overload warnings",
        body: 'Set the overload threshold next to the Forecast button. Any semester (forecast or completed) that exceeds your threshold gets a yellow "⚠ overloaded" tag in its header — a gentle warning that you\'re planning a heavy term. You can absolutely overload on purpose; the tag just makes it visible.',
      },
    ],
  },
};

// ============================================================
// Polished format guide cards
// ============================================================
function FormatGuideCard({ t, theme, title, description, columns, sample }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard
      ?.writeText(sample)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }
  return (
    <div
      className={
        "rounded-lg border overflow-hidden " + t.border + " " + t.panel
      }
    >
      <div
        className={
          "px-4 py-3 border-b " +
          t.border +
          " flex items-center justify-between"
        }
      >
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {description && (
            <div className={"text-[11px] mt-0.5 " + t.textMute}>
              {description}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={copy}
          className={
            "text-xs px-2 py-1 rounded-md border " +
            t.border2 +
            " " +
            (theme === "dark" ? "hover:bg-slate-800" : "hover:bg-slate-100")
          }
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      {columns && columns.length > 0 && (
        <div className={"px-4 py-3 border-b " + t.border}>
          <div
            className={"text-[11px] uppercase tracking-wide mb-2 " + t.textMute}
          >
            Columns
          </div>
          <div className="flex flex-wrap gap-1.5">
            {columns.map((c) => (
              <span
                key={c.name}
                className={
                  "text-[11px] font-mono px-2 py-0.5 rounded border " +
                  (c.required
                    ? theme === "dark"
                      ? "bg-sky-500/15 text-sky-300 border-sky-700"
                      : "bg-sky-50 text-sky-700 border-sky-200"
                    : theme === "dark"
                      ? "bg-slate-800 text-slate-400 border-slate-700"
                      : "bg-slate-100 text-slate-600 border-slate-300")
                }
                title={c.required ? "Required" : "Optional"}
              >
                {c.name}
                {c.required ? "" : " ?"}
              </span>
            ))}
          </div>
          <div className={"mt-2 text-[10px] " + t.textMute}>
            <span
              className={theme === "dark" ? "text-sky-400" : "text-sky-600"}
            >
              colored
            </span>{" "}
            = required ·<span className="ml-1">grey ?</span> = optional
          </div>
        </div>
      )}
      <pre
        className={
          "p-4 font-mono text-[11px] leading-relaxed overflow-auto cf-scroll " +
          (theme === "dark"
            ? "bg-slate-950 text-slate-300"
            : "bg-slate-50 text-slate-700")
        }
      >
        {sample}
      </pre>
    </div>
  );
}

// ============================================================
// PDF text extraction
// ============================================================
let pdfjsLoading = null;
async function ensurePdfJs() {
  if (typeof window === "undefined") return null;
  if (window.pdfjsLib) return window.pdfjsLib;
  if (!pdfjsLoading) {
    pdfjsLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = () => {
        const lib = window.pdfjsLib;
        if (!lib) return reject(new Error("pdf.js failed to attach"));
        lib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(lib);
      };
      s.onerror = () => reject(new Error("Failed to load pdf.js from CDN"));
      document.head.appendChild(s);
    });
  }
  return pdfjsLoading;
}

async function extractTextFromPdf(file) {
  const pdfjs = await ensurePdfJs();
  if (!pdfjs) throw new Error("pdf.js unavailable");
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const lines = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const rows = new Map();
    for (const it of tc.items) {
      const y = Math.round(it.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: it.transform[4], s: it.str });
    }
    const ys = Array.from(rows.keys()).sort((a, b) => b - a);
    for (const y of ys) {
      const row = rows
        .get(y)
        .sort((a, b) => a.x - b.x)
        .map((r) => r.s)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (row) lines.push(row);
    }
    lines.push("");
  }
  return lines.join("\n");
}
