import { describe, it, expect, beforeEach } from "vitest";
import { usePlayerStore } from "../player-store";
import type { SongResponse } from "@/types/api";

function makeSong(overrides: Partial<SongResponse> = {}): SongResponse {
  return {
    id: "song-1",
    title: "Test Song",
    file_path: "test.flac",
    file_format: "flac",
    duration_seconds: 60,
    sample_rate: 48000,
    file_size_bytes: 1000,
    caption: "",
    lyrics: "",
    bpm: 120,
    keyscale: "C major",
    timesignature: "4/4",
    vocal_language: "en",
    instrumental: false,
    is_favorite: false,
    rating: 0,
    tags: "",
    notes: "",
    parent_song_id: null,
    generation_history_id: null,
    variation_index: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("player-store", () => {
  beforeEach(() => {
    usePlayerStore.setState(usePlayerStore.getInitialState());
  });

  it("has correct initial state", () => {
    const state = usePlayerStore.getState();
    expect(state.currentSong).toBeNull();
    expect(state.audioUrl).toBeNull();
    expect(state.queue).toEqual([]);
    expect(state.isPlaying).toBe(false);
    expect(state.volume).toBe(0.8);
    expect(state.showFullPlayer).toBe(false);
  });

  it("play sets currentSong, audioUrl, and isPlaying", () => {
    const song = makeSong();
    usePlayerStore.getState().play(song, "http://test/audio.flac");

    const state = usePlayerStore.getState();
    expect(state.currentSong).toEqual(song);
    expect(state.audioUrl).toBe("http://test/audio.flac");
    expect(state.isPlaying).toBe(true);
    expect(state.currentTime).toBe(0);
  });

  it("play without audioUrl sets audioUrl to null", () => {
    const song = makeSong();
    usePlayerStore.getState().play(song);
    expect(usePlayerStore.getState().audioUrl).toBeNull();
  });

  it("pause and resume toggle isPlaying", () => {
    const song = makeSong();
    usePlayerStore.getState().play(song);
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    usePlayerStore.getState().pause();
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    usePlayerStore.getState().resume();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it("togglePlay flips isPlaying", () => {
    usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it("showFullPlayer defaults to false", () => {
    expect(usePlayerStore.getState().showFullPlayer).toBe(false);
  });

  it("toggleFullPlayer flips showFullPlayer", () => {
    usePlayerStore.getState().toggleFullPlayer();
    expect(usePlayerStore.getState().showFullPlayer).toBe(true);

    usePlayerStore.getState().toggleFullPlayer();
    expect(usePlayerStore.getState().showFullPlayer).toBe(false);
  });

  it("setVolume updates volume and auto-mutes at 0", () => {
    usePlayerStore.getState().setVolume(0);
    expect(usePlayerStore.getState().volume).toBe(0);
    expect(usePlayerStore.getState().muted).toBe(true);

    usePlayerStore.getState().setVolume(0.5);
    expect(usePlayerStore.getState().volume).toBe(0.5);
    expect(usePlayerStore.getState().muted).toBe(false);
  });

  it("toggleMute flips muted state", () => {
    usePlayerStore.getState().toggleMute();
    expect(usePlayerStore.getState().muted).toBe(true);
    usePlayerStore.getState().toggleMute();
    expect(usePlayerStore.getState().muted).toBe(false);
  });

  it("toggleShuffle flips shuffle state", () => {
    usePlayerStore.getState().toggleShuffle();
    expect(usePlayerStore.getState().shuffle).toBe(true);
    usePlayerStore.getState().toggleShuffle();
    expect(usePlayerStore.getState().shuffle).toBe(false);
  });

  it("cycleRepeat cycles through off -> all -> one -> off", () => {
    expect(usePlayerStore.getState().repeat).toBe("off");

    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("all");

    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("one");

    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("off");
  });

  it("addToQueue appends to queue (immutably)", () => {
    const song1 = makeSong({ id: "s1" });
    const song2 = makeSong({ id: "s2" });

    usePlayerStore.getState().addToQueue(song1);
    const queueAfterFirst = usePlayerStore.getState().queue;
    expect(queueAfterFirst).toHaveLength(1);

    usePlayerStore.getState().addToQueue(song2);
    const queueAfterSecond = usePlayerStore.getState().queue;
    expect(queueAfterSecond).toHaveLength(2);
    // Original reference not mutated
    expect(queueAfterFirst).toHaveLength(1);
  });

  it("setQueue replaces the queue", () => {
    const songs = [makeSong({ id: "a" }), makeSong({ id: "b" })];
    usePlayerStore.getState().setQueue(songs);
    expect(usePlayerStore.getState().queue).toEqual(songs);
  });

  it("playNext advances to next song", () => {
    const songs = [
      makeSong({ id: "a", title: "A" }),
      makeSong({ id: "b", title: "B" }),
      makeSong({ id: "c", title: "C" }),
    ];
    usePlayerStore.getState().setQueue(songs);
    usePlayerStore.getState().play(songs[0]);

    usePlayerStore.getState().playNext();
    expect(usePlayerStore.getState().currentSong?.id).toBe("b");
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it("playNext wraps when repeat=all", () => {
    const songs = [makeSong({ id: "a" }), makeSong({ id: "b" })];
    usePlayerStore.setState({ queue: songs, repeat: "all" });
    usePlayerStore.getState().play(songs[1]);

    usePlayerStore.getState().playNext();
    expect(usePlayerStore.getState().currentSong?.id).toBe("a");
  });

  it("playNext does nothing at end when repeat=off", () => {
    const songs = [makeSong({ id: "a" }), makeSong({ id: "b" })];
    usePlayerStore.setState({ queue: songs, repeat: "off" });
    usePlayerStore.getState().play(songs[1]);

    usePlayerStore.getState().playNext();
    // Should still be on song b
    expect(usePlayerStore.getState().currentSong?.id).toBe("b");
  });

  it("playPrevious goes to previous song", () => {
    const songs = [makeSong({ id: "a" }), makeSong({ id: "b" })];
    usePlayerStore.getState().setQueue(songs);
    usePlayerStore.getState().play(songs[1]);

    usePlayerStore.getState().playPrevious();
    expect(usePlayerStore.getState().currentSong?.id).toBe("a");
  });

  it("setCurrentTime and setDuration update state", () => {
    usePlayerStore.getState().setCurrentTime(42.5);
    expect(usePlayerStore.getState().currentTime).toBe(42.5);

    usePlayerStore.getState().setDuration(180);
    expect(usePlayerStore.getState().duration).toBe(180);
  });
});
