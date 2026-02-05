// src/components/SpeakerTopicManager.jsx
import React, { useState } from "react";
import {
  User,
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  X,
  Mail,
  Building,
  Clock,
  Tag,
} from "lucide-react";
import { LECTURE_SERIES } from "../data/lectureData";

export default function SpeakerTopicManager({
  speakers,
  setSpeakers,
  topics,
  setTopics,
  darkMode,
}) {
  const [activeTab, setActiveTab] = useState("speakers");
  const [showAddSpeaker, setShowAddSpeaker] = useState(false);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState(null);
  const [editingTopic, setEditingTopic] = useState(null);

  const [speakerForm, setSpeakerForm] = useState({
    name: "",
    title: "",
    email: "",
    type: "attending",
  });

  const [topicForm, setTopicForm] = useState({
    name: "",
    series: LECTURE_SERIES.CORE_CURRICULUM,
    duration: 60,
  });

  const resetSpeakerForm = () => {
    setSpeakerForm({ name: "", title: "", email: "", type: "attending" });
  };

  const resetTopicForm = () => {
    setTopicForm({ name: "", series: LECTURE_SERIES.CORE_CURRICULUM, duration: 60 });
  };

  const handleAddSpeaker = () => {
    const newSpeaker = {
      id: `sp${Date.now()}`,
      ...speakerForm,
    };
    setSpeakers([...speakers, newSpeaker]);
    setShowAddSpeaker(false);
    resetSpeakerForm();
  };

  const handleUpdateSpeaker = () => {
    setSpeakers(
      speakers.map((s) =>
        s.id === editingSpeaker.id ? { ...s, ...speakerForm } : s
      )
    );
    setEditingSpeaker(null);
    resetSpeakerForm();
  };

  const handleDeleteSpeaker = (id) => {
    if (confirm("Delete this speaker?")) {
      setSpeakers(speakers.filter((s) => s.id !== id));
    }
  };

  const handleAddTopic = () => {
    const newTopic = {
      id: `t${Date.now()}`,
      ...topicForm,
    };
    setTopics([...topics, newTopic]);
    setShowAddTopic(false);
    resetTopicForm();
  };

  const handleUpdateTopic = () => {
    setTopics(
      topics.map((t) =>
        t.id === editingTopic.id ? { ...t, ...topicForm } : t
      )
    );
    setEditingTopic(null);
    resetTopicForm();
  };

  const handleDeleteTopic = (id) => {
    if (confirm("Delete this topic?")) {
      setTopics(topics.filter((t) => t.id !== id));
    }
  };

  const openEditSpeaker = (speaker) => {
    setSpeakerForm({
      name: speaker.name,
      title: speaker.title,
      email: speaker.email,
      type: speaker.type,
    });
    setEditingSpeaker(speaker);
  };

  const openEditTopic = (topic) => {
    setTopicForm({
      name: topic.name,
      series: topic.series,
      duration: topic.duration,
    });
    setEditingTopic(topic);
  };

  const baseClasses = darkMode
    ? "bg-gray-900 text-gray-100"
    : "bg-white text-gray-800";

  const cardClasses = darkMode
    ? "bg-gray-800 border-gray-700"
    : "bg-white border-gray-300";

  const inputClasses = darkMode
    ? "bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
    : "bg-white border-gray-300 text-gray-800";

  const getTypeColor = (type) => {
    switch (type) {
      case "attending":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "fellow":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "external":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    }
  };

  const getSeriesColor = (series) => {
    const colors = {
      [LECTURE_SERIES.CORE_CURRICULUM]: "bg-blue-500",
      [LECTURE_SERIES.JOURNAL_CLUB]: "bg-green-500",
      [LECTURE_SERIES.CASE_CONFERENCE]: "bg-purple-500",
      [LECTURE_SERIES.BOARD_REVIEW]: "bg-yellow-500",
      [LECTURE_SERIES.RESEARCH]: "bg-pink-500",
      [LECTURE_SERIES.GUEST_SPEAKER]: "bg-red-500",
      [LECTURE_SERIES.CATH_CONFERENCE]: "bg-cyan-500",
      [LECTURE_SERIES.ECHO_CONFERENCE]: "bg-teal-500",
      [LECTURE_SERIES.EP_CONFERENCE]: "bg-indigo-500",
      [LECTURE_SERIES.M_AND_M]: "bg-orange-500",
    };
    return colors[series] || "bg-gray-500";
  };

  return (
    <div className={`space-y-4 ${baseClasses}`}>
      {/* Header with Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded overflow-hidden border border-gray-300 dark:border-gray-600">
            <button
              onClick={() => setActiveTab("speakers")}
              className={`flex items-center gap-1 px-4 py-2 text-sm font-semibold ${
                activeTab === "speakers"
                  ? "bg-blue-600 text-white"
                  : darkMode
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <User className="w-4 h-4" />
              Speakers ({speakers.length})
            </button>
            <button
              onClick={() => setActiveTab("topics")}
              className={`flex items-center gap-1 px-4 py-2 text-sm font-semibold ${
                activeTab === "topics"
                  ? "bg-blue-600 text-white"
                  : darkMode
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Topics ({topics.length})
            </button>
          </div>
        </div>

        <button
          onClick={() =>
            activeTab === "speakers" ? setShowAddSpeaker(true) : setShowAddTopic(true)
          }
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded"
        >
          <Plus className="w-3 h-3" />
          Add {activeTab === "speakers" ? "Speaker" : "Topic"}
        </button>
      </div>

      {/* Speakers List */}
      {activeTab === "speakers" && (
        <div className={`rounded border-2 ${cardClasses}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={darkMode ? "bg-gray-700" : "bg-gray-100"}>
                  <th className="px-4 py-2 text-left font-semibold">Name</th>
                  <th className="px-4 py-2 text-left font-semibold">Title</th>
                  <th className="px-4 py-2 text-left font-semibold">Email</th>
                  <th className="px-4 py-2 text-left font-semibold">Type</th>
                  <th className="px-4 py-2 text-center font-semibold w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {speakers.map((speaker) => (
                  <tr
                    key={speaker.id}
                    className={`border-t ${
                      darkMode ? "border-gray-700" : "border-gray-200"
                    }`}
                  >
                    <td className="px-4 py-2 font-medium">{speaker.name}</td>
                    <td className="px-4 py-2 text-gray-500">{speaker.title}</td>
                    <td className="px-4 py-2">
                      {speaker.email && (
                        <a
                          href={`mailto:${speaker.email}`}
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Mail className="w-3 h-3" />
                          {speaker.email}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded capitalize ${getTypeColor(
                          speaker.type
                        )}`}
                      >
                        {speaker.type}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditSpeaker(speaker)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSpeaker(speaker.id)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {speakers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No speakers yet. Add one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Topics List */}
      {activeTab === "topics" && (
        <div className={`rounded border-2 ${cardClasses}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={darkMode ? "bg-gray-700" : "bg-gray-100"}>
                  <th className="px-4 py-2 text-left font-semibold">Topic</th>
                  <th className="px-4 py-2 text-left font-semibold">Series</th>
                  <th className="px-4 py-2 text-center font-semibold">Duration</th>
                  <th className="px-4 py-2 text-center font-semibold w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {topics.map((topic) => (
                  <tr
                    key={topic.id}
                    className={`border-t ${
                      darkMode ? "border-gray-700" : "border-gray-200"
                    }`}
                  >
                    <td className="px-4 py-2 font-medium">{topic.name}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded text-white ${getSeriesColor(
                          topic.series
                        )}`}
                      >
                        {topic.series}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className="flex items-center justify-center gap-1 text-gray-500">
                        <Clock className="w-3 h-3" />
                        {topic.duration} min
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditTopic(topic)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTopic(topic.id)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {topics.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No topics yet. Add one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Speaker Modal */}
      {(showAddSpeaker || editingSpeaker) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`w-full max-w-md rounded-lg shadow-xl ${
              darkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold">
                {editingSpeaker ? "Edit Speaker" : "Add New Speaker"}
              </h3>
              <button
                onClick={() => {
                  setShowAddSpeaker(false);
                  setEditingSpeaker(null);
                  resetSpeakerForm();
                }}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Name *</label>
                <input
                  type="text"
                  value={speakerForm.name}
                  onChange={(e) =>
                    setSpeakerForm({ ...speakerForm, name: e.target.value })
                  }
                  className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                  placeholder="Dr. John Smith"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Title</label>
                <input
                  type="text"
                  value={speakerForm.title}
                  onChange={(e) =>
                    setSpeakerForm({ ...speakerForm, title: e.target.value })
                  }
                  className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                  placeholder="Interventional Cardiology"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={speakerForm.email}
                  onChange={(e) =>
                    setSpeakerForm({ ...speakerForm, email: e.target.value })
                  }
                  className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                  placeholder="smith@hospital.edu"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Type</label>
                <select
                  value={speakerForm.type}
                  onChange={(e) =>
                    setSpeakerForm({ ...speakerForm, type: e.target.value })
                  }
                  className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                >
                  <option value="attending">Attending</option>
                  <option value="fellow">Fellow</option>
                  <option value="external">External</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowAddSpeaker(false);
                    setEditingSpeaker(null);
                    resetSpeakerForm();
                  }}
                  className="px-4 py-2 text-sm font-semibold rounded bg-gray-200 dark:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={editingSpeaker ? handleUpdateSpeaker : handleAddSpeaker}
                  disabled={!speakerForm.name}
                  className="px-4 py-2 text-sm font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {editingSpeaker ? "Update" : "Add"} Speaker
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Topic Modal */}
      {(showAddTopic || editingTopic) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`w-full max-w-md rounded-lg shadow-xl ${
              darkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold">
                {editingTopic ? "Edit Topic" : "Add New Topic"}
              </h3>
              <button
                onClick={() => {
                  setShowAddTopic(false);
                  setEditingTopic(null);
                  resetTopicForm();
                }}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Topic Name *
                </label>
                <input
                  type="text"
                  value={topicForm.name}
                  onChange={(e) =>
                    setTopicForm({ ...topicForm, name: e.target.value })
                  }
                  className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                  placeholder="STEMI Management"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Series</label>
                <select
                  value={topicForm.series}
                  onChange={(e) =>
                    setTopicForm({ ...topicForm, series: e.target.value })
                  }
                  className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                >
                  {Object.values(LECTURE_SERIES).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Default Duration (min)
                </label>
                <input
                  type="number"
                  value={topicForm.duration}
                  onChange={(e) =>
                    setTopicForm({
                      ...topicForm,
                      duration: parseInt(e.target.value) || 60,
                    })
                  }
                  className={`w-full px-3 py-2 text-sm border rounded ${inputClasses}`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowAddTopic(false);
                    setEditingTopic(null);
                    resetTopicForm();
                  }}
                  className="px-4 py-2 text-sm font-semibold rounded bg-gray-200 dark:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={editingTopic ? handleUpdateTopic : handleAddTopic}
                  disabled={!topicForm.name}
                  className="px-4 py-2 text-sm font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {editingTopic ? "Update" : "Add"} Topic
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}