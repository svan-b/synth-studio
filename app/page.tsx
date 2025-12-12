'use client';

import { useState } from 'react';
import { useStudioStore } from '@/store/studio';
import { deviceRegistry, lessonRegistry } from '@/data/devices';
import DFAM from '@/components/devices/DFAM';
import Instructions from '@/components/teaching/Instructions';
import * as Select from '@radix-ui/react-select';
import * as Dialog from '@radix-ui/react-dialog';

export default function Home() {
  const { currentDevice, setCurrentDevice, startLesson, isTeachingMode, resetLesson, completedLessons } = useStudioStore();
  const [showLessonDialog, setShowLessonDialog] = useState(false);

  // Device configuration with components
  const devices = [
    { id: 'dfam', name: 'Moog DFAM', component: DFAM, available: true },
    { id: 'mother32', name: 'Moog Mother-32', available: false },
    { id: 'subharmonicon', name: 'Moog Subharmonicon', available: false },
    { id: 'analog-four', name: 'Elektron Analog Four MKII', available: false },
    { id: 'analog-rytm', name: 'Elektron Analog Rytm MKII', available: false },
    { id: 'sub-37', name: 'Moog Sub 37', available: false },
    { id: 'xone-96', name: 'Allen & Heath Xone:96', available: false },
  ];

  // Get device spec for additional info
  const deviceSpec = deviceRegistry.getDevice(currentDevice);

  // Get lessons for current device
  const lessons = lessonRegistry.getLessonsForDevice(currentDevice);

  const handleStartLesson = (lessonIndex: number) => {
    startLesson(lessons[lessonIndex]);
    setShowLessonDialog(false);
  };

  const currentDeviceData = devices.find(d => d.id === currentDevice);
  const DeviceComponent = currentDeviceData?.component;

  // Check if lesson is completed
  const isLessonCompleted = (lessonId: string) => completedLessons.includes(lessonId);

  return (
    <div className="min-h-screen bg-hardware-bg p-6">
      {/* Header */}
      <header className="max-w-screen-2xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              SYNTH STUDIO
            </h1>
            <p className="text-sm text-hardware-label">
              Digital Twin Learning System • Pixel-Perfect Hardware Replicas
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            {/* Device Selector */}
            <div>
              <label className="block text-xs text-hardware-label uppercase tracking-wider mb-1 font-label">
                Device
              </label>
              <Select.Root value={currentDevice} onValueChange={setCurrentDevice}>
                <Select.Trigger className="inline-flex items-center justify-between gap-2 rounded px-4 py-2 text-sm bg-hardware-panel border-2 border-[#3a3a3a] text-white min-w-[240px] hover:brightness-110 transition-all">
                  <Select.Value />
                  <Select.Icon>▼</Select.Icon>
                </Select.Trigger>

                <Select.Portal>
                  <Select.Content className="overflow-hidden bg-hardware-panel border-2 border-[#3a3a3a] rounded shadow-2xl z-50">
                    <Select.Viewport className="p-1">
                      {devices.map((device) => (
                        <Select.Item
                          key={device.id}
                          value={device.id}
                          disabled={!device.available}
                          className={`
                            relative flex items-center px-6 py-2 text-sm rounded cursor-pointer outline-none
                            ${device.available
                              ? 'text-white hover:bg-[#3a3a3a] data-[highlighted]:bg-[#3a3a3a]'
                              : 'text-hardware-label cursor-not-allowed opacity-50'
                            }
                          `}
                        >
                          <Select.ItemText>{device.name}</Select.ItemText>
                          {!device.available && (
                            <span className="ml-auto text-xs text-hardware-label">Coming Soon</span>
                          )}
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            {/* Lesson Button */}
            <div>
              <label className="block text-xs text-hardware-label uppercase tracking-wider mb-1 font-label">
                Learning
              </label>
              <button
                onClick={() => setShowLessonDialog(true)}
                disabled={lessons.length === 0}
                className="px-6 py-2 bg-teaching-current text-black font-bold rounded text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTeachingMode ? 'Change Lesson' : 'Start Lesson'}
              </button>
            </div>

            {/* Stop Teaching Mode */}
            {isTeachingMode && (
              <div>
                <label className="block text-xs text-transparent uppercase tracking-wider mb-1 font-label">
                  -
                </label>
                <button
                  onClick={resetLesson}
                  className="px-6 py-2 bg-teaching-wrong text-white font-bold rounded text-sm hover:brightness-110 transition-all"
                >
                  Stop Teaching
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Device Info */}
        {currentDeviceData && (
          <div className="bg-hardware-panel border border-[#3a3a3a] rounded p-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {deviceSpec?.name || currentDeviceData.name}
                </h2>
                <p className="text-xs text-hardware-label mt-1">
                  {deviceSpec?.manufacturer && `${deviceSpec.manufacturer} • `}
                  {lessons.length} lesson{lessons.length !== 1 ? 's' : ''} available •
                  All specifications verified from official manual
                </p>
              </div>
              {!currentDeviceData.available && (
                <span className="px-3 py-1 bg-[#3a3a3a] text-hardware-label text-xs rounded font-bold">
                  COMING SOON
                </span>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Device Display */}
      <main className="max-w-screen-2xl mx-auto">
        {DeviceComponent ? (
          <div className="flex justify-center overflow-x-auto">
            <DeviceComponent />
          </div>
        ) : (
          <div className="bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-12 text-center">
            <h3 className="text-xl font-bold text-hardware-label mb-2">
              Device Coming Soon
            </h3>
            <p className="text-sm text-hardware-label">
              This device is currently being developed.
            </p>
          </div>
        )}
      </main>

      {/* Teaching Instructions Sidebar */}
      <Instructions />

      {/* Lesson Selection Dialog */}
      <Dialog.Root open={showLessonDialog} onOpenChange={setShowLessonDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-hardware-panel border-2 border-[#3a3a3a] rounded-lg p-6 w-full max-w-lg shadow-2xl z-50">
            <Dialog.Title className="text-xl font-bold text-white mb-2">
              Choose a Lesson
            </Dialog.Title>
            <Dialog.Description className="text-sm text-hardware-label mb-4">
              Select a lesson to begin guided practice. Controls will highlight to show you where to adjust.
            </Dialog.Description>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {lessons.map((lesson, index) => (
                <button
                  key={lesson.id}
                  onClick={() => handleStartLesson(index)}
                  className="w-full text-left p-4 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#3a3a3a] rounded transition-all group"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white group-hover:text-teaching-current transition-colors">
                        {lesson.name}
                      </h4>
                      {isLessonCompleted(lesson.id) && (
                        <span className="text-xs text-green-500">✓ Completed</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        lesson.difficulty === 'beginner' ? 'bg-green-900 text-green-300' :
                        lesson.difficulty === 'intermediate' ? 'bg-yellow-900 text-yellow-300' :
                        'bg-red-900 text-red-300'
                      }`}>
                        {lesson.difficulty}
                      </span>
                      <span className="text-xs text-hardware-label bg-[#2a2a2a] px-2 py-0.5 rounded">
                        {lesson.steps.length} steps
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-hardware-label mb-2">
                    {lesson.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-hardware-label">
                    <span>Source: {lesson.source}</span>
                    {lesson.estimatedMinutes && (
                      <>
                        <span>•</span>
                        <span>~{lesson.estimatedMinutes} min</span>
                      </>
                    )}
                    {lesson.tags && lesson.tags.length > 0 && (
                      <>
                        <span>•</span>
                        <span>{lesson.tags.slice(0, 3).join(', ')}</span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button className="px-4 py-2 bg-[#3a3a3a] text-white rounded hover:brightness-110 transition-all">
                  Cancel
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Footer */}
      <footer className="max-w-screen-2xl mx-auto mt-8 text-center text-xs text-hardware-label">
        <p>
          Synth Studio • Digital Twin Learning System • All device specifications verified from official manuals
        </p>
        <p className="mt-1">
          {deviceSpec?.manualUrl && (
            <>
              <a
                href={deviceSpec.manualUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-teaching-current transition-colors"
              >
                {deviceSpec.name} Manual
              </a>
              {' • '}
            </>
          )}
          Built with Next.js 14, TypeScript, and Tailwind CSS
        </p>
      </footer>
    </div>
  );
}
