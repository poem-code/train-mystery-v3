#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-audio.py —— 程序合成音效（无外部素材、无版权风险）

输出：assets/audio/*.wav  16bit / 22050Hz / 单声道
体积：单文件 4—22KB，全部合计约 100KB，对抖音小游戏包体友好。

设计原则：
- 全用「正弦/噪声 + 指数衰减包络」合成，不追求真实，只要动作反馈清晰
- 每个音效控制在 0.4 秒内，避免打断节奏
- 打击音走「低频冲击 + 高频噪声」双层，听得见但不吵
"""

import math
import os
import random
import struct
import wave

SR = 22050
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "audio")


def env(i, n, attack=0.005, decay=6.0):
    """指数衰减包络：前 attack 比例淡入，其余指数衰减"""
    t = i / float(n)
    a = max(1, int(n * attack))
    if i < a:
        return i / float(a)
    return math.exp(-(t - attack) * decay)


def tone(freq_start, freq_end, dur, amp=0.5, decay=6.0, wave_type="sine", noise=0.0):
    n = int(SR * dur)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / float(n)
        f = freq_start + (freq_end - freq_start) * t
        phase += 2 * math.pi * f / SR
        if wave_type == "sine":
            v = math.sin(phase)
        elif wave_type == "square":
            v = 1.0 if math.sin(phase) > 0 else -1.0
        elif wave_type == "tri":
            v = 2.0 / math.pi * math.asin(math.sin(phase))
        else:
            v = math.sin(phase)
        if noise > 0:
            v = v * (1 - noise) + (random.random() * 2 - 1) * noise
        out.append(v * amp * env(i, n, decay=decay))
    return out


def noise_burst(dur, amp=0.4, decay=12.0, lp=0.35):
    """低通过的噪声爆：用于摩擦、脚步、破空"""
    n = int(SR * dur)
    out = []
    prev = 0.0
    for i in range(n):
        raw = random.random() * 2 - 1
        prev = prev + (raw - prev) * lp
        out.append(prev * amp * env(i, n, decay=decay))
    return out


def mix(*tracks):
    n = max(len(t) for t in tracks)
    out = [0.0] * n
    for t in tracks:
        for i, v in enumerate(t):
            out[i] += v
    return out


def seq(parts, gap=0.0):
    """顺序拼接"""
    out = []
    for p in parts:
        out.extend(p)
        if gap > 0:
            out.extend([0.0] * int(SR * gap))
    return out


def fade_tail(samples, ms=12):
    n = int(SR * ms / 1000.0)
    total = len(samples)
    for i in range(min(n, total)):
        k = i / float(n)
        samples[total - 1 - i] *= k


def write_wav(name, samples, peak=0.86):
    os.makedirs(OUT_DIR, exist_ok=True)
    m = max(1e-6, max(abs(s) for s in samples))
    scale = peak / m
    data = bytearray()
    for s in samples:
        v = int(max(-1.0, min(1.0, s * scale)) * 32767)
        data.extend(struct.pack("<h", v))
    path = os.path.join(OUT_DIR, name + ".wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(bytes(data))
    return path, os.path.getsize(path)


def build():
    files = []

    # 1) 点击：短促清脆
    s = mix(tone(1180, 820, 0.05, 0.55, decay=18), noise_burst(0.03, 0.10, decay=24, lp=0.6))
    files.append(("tap", s))

    # 2) 拉弓：破空上滑 + 噪声
    s = mix(tone(320, 900, 0.11, 0.26, decay=10, noise=0.25), noise_burst(0.10, 0.20, decay=9, lp=0.5))
    files.append(("bow", s))

    # 3) 命中：低频冲击 + 噪声拍
    s = mix(
        tone(190, 82, 0.13, 0.72, decay=13),
        noise_burst(0.09, 0.34, decay=16, lp=0.42),
        tone(720, 300, 0.05, 0.20, decay=20, noise=0.3),
    )
    files.append(("hit", s))

    # 4) 重击：更沉更长
    s = mix(
        tone(150, 52, 0.24, 0.85, decay=8),
        noise_burst(0.16, 0.40, decay=11, lp=0.30),
        tone(420, 120, 0.10, 0.24, decay=14, noise=0.35),
    )
    files.append(("crit", s))

    # 5) 护盾：金属高频
    s = mix(
        tone(880, 760, 0.16, 0.34, decay=11, wave_type="tri"),
        tone(1320, 1180, 0.14, 0.22, decay=13, wave_type="tri"),
        noise_burst(0.05, 0.12, decay=20, lp=0.8),
    )
    files.append(("shield", s))

    # 6) 治疗：上行三音
    s = seq([
        tone(523, 523, 0.09, 0.34, decay=5),
        tone(659, 659, 0.09, 0.34, decay=5),
        tone(784, 784, 0.16, 0.34, decay=4),
    ])
    files.append(("heal", s))

    # 7) 金币/以太
    s = mix(tone(1568, 1568, 0.06, 0.30, decay=14), tone(2093, 2093, 0.09, 0.24, decay=12))
    files.append(("coin", s))

    # 8) 胜利：上行琶音
    s = seq([
        tone(523, 523, 0.10, 0.32, decay=4, wave_type="tri"),
        tone(659, 659, 0.10, 0.32, decay=4, wave_type="tri"),
        tone(784, 784, 0.10, 0.32, decay=4, wave_type="tri"),
        tone(1046, 1046, 0.30, 0.34, decay=2.4, wave_type="tri"),
    ])
    files.append(("win", s))

    # 9) 失败：下行
    s = seq([
        tone(392, 392, 0.16, 0.34, decay=3.6, wave_type="tri"),
        tone(311, 311, 0.16, 0.34, decay=3.6, wave_type="tri"),
        tone(233, 233, 0.42, 0.36, decay=2.2, wave_type="tri"),
    ])
    files.append(("lose", s))

    # 10) 步骤/推进
    s = mix(noise_burst(0.10, 0.30, decay=14, lp=0.22), tone(120, 76, 0.08, 0.30, decay=16))
    files.append(("step", s))

    # 11) 翻牌/选择确认
    s = mix(tone(660, 990, 0.08, 0.34, decay=10, wave_type="tri"), noise_burst(0.04, 0.10, decay=20, lp=0.7))
    files.append(("select", s))

    # 12) 危险预警
    s = mix(tone(220, 180, 0.20, 0.42, decay=4.5, wave_type="square", noise=0.1),
            tone(440, 360, 0.18, 0.18, decay=5))
    files.append(("alert", s))

    total = 0
    for name, samples in files:
        fade_tail(samples, 10)
        path, size = write_wav(name, samples)
        total += size
        print("  %-8s %6.1f KB" % (name, size / 1024.0))
    print("音效合计 %.1f KB，目录：%s" % (total / 1024.0, os.path.normpath(OUT_DIR)))




# ---------------------------------------------------------------- BGM
# 循环背景乐：SR 降到 11025 换体积（12 秒单声道约 264KB），
# 时长与频率都取整数个周期，接缝处不会「咔」一声。

SR_BGM = 11025
BGM_DIR = OUT_DIR


def write_wav_at(name, samples, sr, peak=0.72, out_dir=None):
    target = out_dir or BGM_DIR
    os.makedirs(target, exist_ok=True)
    m = max(1e-6, max(abs(s) for s in samples))
    scale = peak / m
    data = bytearray()
    for s in samples:
        v = int(max(-1.0, min(1.0, s * scale)) * 32767)
        data.extend(struct.pack("<h", v))
    path = os.path.join(target, name + ".wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(bytes(data))
    return path, os.path.getsize(path)


def lo_noise(n, lp=0.06):
    out = []
    prev = 0.0
    for _ in range(n):
        raw = random.random() * 2 - 1
        prev = prev + (raw - prev) * lp
        out.append(prev)
    return out


def note_into(buf, start_s, freq, dur, amp, sr, wave_type="sine", attack=0.25):
    """把一个带包络的音符叠加进缓冲区（越界部分丢弃，正好形成循环）"""
    n = int(sr * dur)
    start = int(start_s * sr)
    total = len(buf)
    for i in range(n):
        idx = start + i
        if idx >= total:
            break
        t = i / float(n)
        a = attack if t < attack else 1.0
        env = (t / attack) if t < attack else math.exp(-(t - attack) * 2.2)
        phase = 2 * math.pi * freq * (i / float(sr))
        if wave_type == "sine":
            v = math.sin(phase)
        elif wave_type == "tri":
            v = 2.0 / math.pi * math.asin(math.sin(phase))
        else:
            v = math.sin(phase)
        buf[idx] += v * amp * env * a


def drone(n, freqs, amps, sr, lfo_cycles=1):
    out = [0.0] * n
    for i in range(n):
        t = i / float(sr)
        lfo = 0.82 + 0.18 * math.sin(2 * math.pi * (lfo_cycles / (n / float(sr))) * t)
        v = 0.0
        for f, a in zip(freqs, amps):
            v += a * math.sin(2 * math.pi * f * t)
        out[i] = v * lfo
    return out


def fade_edges(samples, ms=120, sr=SR_BGM):
    n = int(sr * ms / 1000.0)
    total = len(samples)
    for i in range(min(n, total)):
        k = i / float(n)
        samples[i] *= k
        samples[total - 1 - i] *= k


def build_bgm():
    sr = SR_BGM
    dur = 12.0
    n = int(sr * dur)
    # A 小调五声音阶，冷、空、不抢注意力
    scale = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25]
    files = []

    # 1) 主城：低音持续 + 稀疏拨弦 + 蒸汽噪声
    home = drone(n, [110.0, 164.81, 440.0 / 2], [0.22, 0.13, 0.05], sr, lfo_cycles=1)
    steam = lo_noise(n, lp=0.02)
    for i in range(n):
        home[i] += steam[i] * 0.16 * (0.5 + 0.5 * math.sin(2 * math.pi * (2.0 / dur) * (i / float(sr))))
    times = [0.4, 1.9, 3.4, 5.2, 6.9, 8.6, 10.3]
    for k, t in enumerate(times):
        note_into(home, t, scale[(k * 2) % len(scale)], 1.6, 0.10, sr, "tri")
    files.append(("bgm_home", home))

    # 2) 路线：更疏、更冷，加风声
    route = drone(n, [98.0, 146.83, 196.0], [0.18, 0.11, 0.06], sr, lfo_cycles=2)
    wind = lo_noise(n, lp=0.035)
    for i in range(n):
        route[i] += wind[i] * 0.30 * (0.35 + 0.65 * abs(math.sin(2 * math.pi * (1.0 / dur) * (i / float(sr)))))
    for k, t in enumerate([0.2, 2.4, 4.6, 7.1, 9.4, 11.0]):
        note_into(route, t, scale[k % len(scale)] * 0.5, 0.9, 0.13, sr, "tri", attack=0.12)
    files.append(("bgm_route", route))

    # 3) 战斗：脉冲低鼓 + 不协和长音
    battle = drone(n, [73.42, 77.78, 155.56], [0.20, 0.12, 0.06], sr, lfo_cycles=4)
    beat = 0.6  # 100 BPM
    pulse_times = []
    t0 = 0.0
    while t0 < dur - 0.1:
        pulse_times.append(t0)
        t0 += beat
    for t in pulse_times:
        start = int(t * sr)
        ln = int(0.22 * sr)
        for i in range(ln):
            idx = start + i
            if idx >= n:
                break
            k = i / float(ln)
            f = 92.0 - 46.0 * k
            battle[idx] += math.sin(2 * math.pi * f * (i / float(sr))) * 0.34 * math.exp(-k * 7.0)
    tick = lo_noise(n, lp=0.5)
    for i in range(n):
        battle[i] += tick[i] * 0.05
    files.append(("bgm_battle", battle))

    total = 0
    for name, samples in files:
        fade_edges(samples, 120, sr)
        path, size = write_wav_at(name, samples, sr)
        total += size
        print("  %-12s %6.1f KB" % (name, size / 1024.0))
    print("BGM 合计 %.1f KB" % (total / 1024.0))


if __name__ == "__main__":
    random.seed(20261110)
    build()
    build_bgm()
