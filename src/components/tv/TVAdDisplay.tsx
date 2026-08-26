'use client'

import { useState, useEffect, useRef } from 'react'
import { clsx } from 'clsx'

export interface TVAd {
  id: string
  type: 'video' | 'image' | 'text'
  /** URL for video/image */
  url?: string
  /** Text content for marquee or overlay */
  text?: string
  /** Duration in seconds for rotation (image/video) */
  duration: number
  /** Active */
  active: boolean
}

interface TVAdDisplayProps {
  ads: TVAd[]
  /** Height of the ad banner in pixels */
  height?: number
  className?: string
}

/* ═══════ Marquee Text ═══════ */
function MarqueeText({ text, speed = 60 }: { text: string; speed?: number }) {
  return (
    <div className="relative w-full h-full overflow-hidden flex items-center bg-gradient-to-r from-cyan-900/60 via-cyan-800/40 to-cyan-900/60 border border-cyan-400/30">
      <div
        className="absolute whitespace-nowrap text-xl font-black text-cyan-200 px-8 drop-shadow-lg"
        style={{
          animation: `marquee ${speed}s linear infinite`,
          textShadow: '0 0 20px rgba(34,211,238,0.5), 0 0 40px rgba(34,211,238,0.3)',
        }}
      >
        {text}
        {'   ★   '}
        {text}
        {'   ★   '}
        {text}
        {'   ★   '}
        {text}
        {'   ★   '}
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(100vw); }
          100% { transform: translateX(-200%); }
        }
      `}</style>
    </div>
  )
}

/* ═══════ Image Ad ═══════ */
function ImageAd({ url, duration }: { url: string; duration: number }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl border border-white/10">
      <img
        src={url}
        alt="โฆษณา"
        className={clsx(
          'w-full h-full object-cover transition-opacity duration-500',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={() => setLoaded(true)}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/5">
          <span className="text-gray-500 text-sm">🖼️ กำลังโหลด...</span>
        </div>
      )}
    </div>
  )
}

/* ═══════ Video Ad ═══════ */
function VideoAd({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(false)

  return (
    <div className="relative w-full h-full overflow-hidden bg-black rounded-xl border border-white/10">
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <span className="text-gray-500 text-sm">ไม่สามารถโหลดวิดีโอได้</span>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={url}
          className="w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          onError={() => setError(true)}
        />
      )}
    </div>
  )
}

/* ═══════ Main Ad Display ═══════ */
export default function TVAdDisplay({ ads, height = 160, className }: TVAdDisplayProps) {
  const activeAds = ads.filter(a => a.active)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (activeAds.length <= 1) return
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % activeAds.length)
    }, (activeAds[currentIndex]?.duration || 10) * 1000)
    return () => clearInterval(timer)
  }, [activeAds, currentIndex])

  if (activeAds.length === 0) return null

  const currentAd = activeAds[currentIndex % activeAds.length]

  return (
    <div className={clsx('relative', className)} style={{ minHeight: height }}>
      {/* Ad Content */}
      <div style={{ height }} className="rounded-xl overflow-hidden">
        {currentAd.type === 'video' && currentAd.url && (
          <VideoAd url={currentAd.url} />
        )}
        {currentAd.type === 'image' && currentAd.url && (
          <ImageAd url={currentAd.url} duration={currentAd.duration} />
        )}
        {currentAd.type === 'text' && currentAd.text && (
          <MarqueeText text={currentAd.text} />
        )}
      </div>

      {/* Dots indicator */}
      {activeAds.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {activeAds.map((_, i) => (
            <div
              key={i}
              className={clsx(
                'w-1.5 h-1.5 rounded-full transition-all duration-300',
                i === currentIndex % activeAds.length
                  ? 'bg-white w-4'
                  : 'bg-white/30'
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
