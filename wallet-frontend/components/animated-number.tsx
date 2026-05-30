'use client'

import { useSpring, animated } from '@react-spring/web'

export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 2,
  className = '',
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
}) {
  const { n } = useSpring({
    from: { n: 0 },
    n: value,
    config: { tension: 120, friction: 30 },
  })

  return (
    <animated.span className={className}>
      {n.to((v) => `${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`)}
    </animated.span>
  )
}
