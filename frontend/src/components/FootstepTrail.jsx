import { useEffect, useState } from 'react'
import './FootstepTrail.css'

const FOOTPRINT_SHAPES = [
  [50.86759744022923, -21.798383338076917, 54.16000854997335, -23.917474843549847, 57.778065334829385, -25.310771525314685, 61.579706305344985, -24.823762596975733, 65.0168431653022, -22.69100336700319, 65.22736925598322, -19.777045647294724, 63.09649708656406, -16.826669881834157, 59.66512409715465, -15.356252875428147, 56.12216018899968, -14.92259970211097, 52.06404407417057, -16.231839553378, 50.2945579442406, -18.938589556263246],
  [60.12039562389232, -12.45714817900668, 63.92394094034509, -14.994440399059425, 68.75013312287521, -15.737202635924493, 73.10937504616481, -14.878459739068003, 76.36064492186433, -12.559833524837757, 77.6863729180915, -9.181208344485064, 75.4625672565435, -5.673231626251427, 71.79886053681197, -3.7381471592011817, 66.8618942467243, -3.4903609701416993, 62.29264392518654, -5.1248680438596885, 58.98975517513061, -8.760952968033395],
  [65.57414109270752, 1.1797411270282658, 69.37768640916029, -1.3575510930244814, 74.20387859169041, -2.1003133298895467, 78.56312051498001, -1.241570433033059, 81.81439039067953, 1.0770557811971881, 83.14011838690669, 4.455680961549877, 80.9163127253587, 7.963657679783514, 77.25260600562717, 9.898742146833756, 72.3156397155395, 10.146528335893239, 67.74638939400174, 8.512021262175251, 64.44350064394581, 4.875936338001546],
  [65.89915812212375, 15.917267748549033, 69.97688522977245, 12.635767809535894, 76.25232402290966, 11.736330263416008, 81.47328014710077, 12.477566678331382, 86.09545897877996, 15.579569438835726, 86.99032987455637, 21.425830739951824, 83.82647235747945, 24.97297628549917, 79.18353918133074, 27.064789354098487, 73.69821507617947, 27.23418460503707, 68.46309469655478, 24.972976285499172, 64.88602415530316, 20.55351481505123],
  [58.48881251239855, 36.09589759380796, 65.7080603859302, 29.82038065752831, 74.19222753183148, 28.331948884004674, 82.75081761131048, 31.085582242549528, 88.10923922724437, 34.28575070762116, 91.45825273720305, 41.65358042953028, 87.067323913035, 47.45853718012533, 79.77391671356942, 50.28659303297933, 71.73628428966856, 50.06332546564875, 64.14518700042888, 47.45853718012533, 60.12637078847845, 42.69549574373964],
  [-73.48953442580058, 20.579088801900756, -80.48690958722098, 13.959950657259256, -81.93681598574045, 6.269142804242765, -81.49554012532147, -1.6107832746678348, -77.90207999991593, -9.181527272091415, -71.6611785393426, -14.98115303708649, -64.60076477263831, -17.880965834138024, -57.35123278004056, -19.078714598132443, -50.09111381970131, -19.902008890566687, -42.96765884171789, -19.08249722231963, -35.655087439697766, -18.51514254492067, -28.90987071615029, -18.578181953551955, -21.74774447703016, -19.60773669210723, -14.309090001741001, -20.364210136314323, -6.933479190821032, -21.688037717705875, 0.33383104043200396, -22.888118253462963, 7.772483543580581, -23.77067027395373, 15.274173171058239, -24.338024951681817, 22.460665755024706, -24.590182586206954, 29.710197747622452, -23.707630865368966, 36.8557533915613, -22.565778766908277, 44.16832856198768, -19.28772830000901, 51.48089996424725, -14.370654426435763, 56.713170880643965, -7.499358885625703, 60.24016927073608, -0.41616112008138906, 61.75311234056134, 6.518193267525415, 62.38350642684393, 13.515567625813127, 61.67231220934209, 20.50500542283382, 59.08769637136125, 27.56541945045329, 54.35974072401175, 34.87799085169213, 48.686193947196124, 39.41682827314464, 41.87793781501736, 42.379680478815025, 34.313208779263185, 43.26223219965301, 27.063676786665432, 42.25360166155246, 19.625026568173826, 38.28211891778152, 13.457927624759604, 31.720792179781256, 9.486440924356895, 25.290772320002496, 6.019273449215143, 18.7346738223298, 0.21964785513691965, 13.565442314564446, -5.832135373466421, 9.467880753530935, -12.632472285211591, 8.882365666622222, -19.188577231399584, 11.277861070017005, -26.31203040678842, 14.49287091019486, -32.99420772170462, 17.833959567652954, -39.2981485848331, 20.670732956060768, -45.854247082486715, 23.192309301312157, -52.47338498877162, 24.89437333435685, -59.5968381641068, 25.020452151619416, -67.33461307855538, 23.697386555044208]
]

const FOOTPRINT_POLYGONS = FOOTPRINT_SHAPES.map((shape) => {
  const points = []
  for (let index = 0; index < shape.length; index += 2) {
    points.push(`${shape[index]},${shape[index + 1]}`)
  }
  return points.join(' ')
})

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function measureDocumentHeight() {
  if (typeof document === 'undefined') return 0
  return Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  )
}

function createFootsteps(count, viewportWidth, viewportHeight, documentHeight) {
  const stepSize = clamp(viewportWidth * 0.09, 42, 76)
  const stepSpacing = clamp(viewportWidth * 0.18, 80, 118)
  const pathDrift = clamp(viewportWidth * 0.055, 14, 44)
  const pathOffset = stepSize * 0.28
  const startY = viewportHeight * 0.6
  const endY = documentHeight - stepSize * 1.8
  const steps = []

  for (let index = 0; index < count; index += 1) {
    const top = startY + index * stepSpacing
    if (top > endY) break

    const isLeft = index % 2 === 0
    const drift = Math.sin(index * 0.75) * pathDrift
    const centerBias = Math.sin(index * 0.28) * pathDrift * 0.45
    const x = viewportWidth / 2 + drift + centerBias + (isLeft ? -pathOffset : pathOffset)
    const rotation = (isLeft ? -20 : 20) + Math.sin(index * 0.55) * 7

    steps.push({
      id: index,
      isLeft,
      left: x,
      top,
      size: stepSize,
      rotation
    })
  }

  return {
    steps,
    stepSpacing
  }
}

function FootstepTrail({ maxScrollY, contentKey }) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [documentHeight, setDocumentHeight] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const updateMetrics = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight
      })
      setDocumentHeight(measureDocumentHeight())
    }

    updateMetrics()

    const animationFrame = window.requestAnimationFrame(updateMetrics)
    window.addEventListener('resize', updateMetrics)

    let observer
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateMetrics)
      observer.observe(document.body)
    }

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', updateMetrics)
      observer?.disconnect()
    }
  }, [contentKey])

  if (!viewport.width || !documentHeight) {
    return null
  }

  const { stepSpacing } = createFootsteps(0, viewport.width, viewport.height, documentHeight)
  const renderedStepCount = Math.max(0, Math.floor(maxScrollY / stepSpacing))
  const { steps } = createFootsteps(renderedStepCount, viewport.width, viewport.height, documentHeight)

  return (
    <div
      className="footstep-trail"
      aria-hidden="true"
      style={{ height: `${documentHeight}px` }}
    >
      {steps.map((step) => (
        <span
          key={step.id}
          className={`footstep ${step.isLeft ? 'footstep--left' : 'footstep--right'}`}
          style={{
            '--footstep-left': `${step.left}px`,
            '--footstep-top': `${step.top}px`,
            '--footstep-size': `${step.size}px`,
            '--footstep-rotation': `${step.rotation}deg`
          }}
        >
          <svg
            className="footstep-svg"
            viewBox="-90 -30 185 85"
            focusable="false"
            aria-hidden="true"
          >
            {FOOTPRINT_POLYGONS.map((points) => (
              <polygon key={points} points={points} />
            ))}
          </svg>
        </span>
      ))}
    </div>
  )
}

export default FootstepTrail
