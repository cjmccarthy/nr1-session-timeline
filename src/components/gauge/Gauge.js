import React, { Component } from 'react'
import PropTypes from 'prop-types'

import { Stack, StackItem } from 'nr1'

import GaugeDataLegendItem from './GaugeDataLegendItem'
import GaugeDataValue from './GaugeDataValue'

export default class Gauge extends Component {
  static propTypes = {
    /**
     * A list of data to be rendered:
     *
     * [{value, label, color}]
     */
    data: PropTypes.array.isRequired,
    /**
     * The height of the gauge in pixels
     */
    height: PropTypes.number,
    /**
     * The starting color of the gauge:
     *
     * Find the hue of any rgb or hex string using
     * [HSL selector](http://hslpicker.com).
     */
    hue: PropTypes.number,
    /**
     * To show, or not to show?
     *
     * That is the question.
     */
    showLegend: PropTypes.bool,
  }

  static defaultProps = {
    height: 15,
    hue: 193,
    showLegend: true,
  }

  proportionateValues = () => {
    const { data, legend, height } = this.props
    const totalValue = data.reduce((acc, { value }) => {
      acc += value
      return acc
    }, 0)

    return data.map(({ value, label, color, warnings }, index) => {
      const displayColor = color || this.generateColor(index, data.length)
      const proportionateValue = (value * 100) / totalValue
      const { showWarningsOnly } = this.props

      let visible = true

      if (showWarningsOnly && !warnings) visible = false
      if (visible)
        for (let legendItem of legend) {
          if (legendItem.group.timelineDisplay.label === label) {
            visible = legendItem.visible
            break
          }
        }

      return {
        value: proportionateValue,
        label,
        color: displayColor,
        height,
        visible,
      }
    })
  }

  generateColor = (size, scale) => {
    const { hue } = this.props
    const defaultSaturation = 70
    const defaultMinLightness = 25
    const lightnessRange = 70

    const lightnessScale = Math.round(lightnessRange / scale)
    const appliedLightness = defaultMinLightness + size * lightnessScale
    return `hsl(${hue},${defaultSaturation}%,${appliedLightness}%)`
  }

  renderTimeAxis(data) {
    const numberOfAxisValues = 6 
    const desiredAxisItems = [...Array(numberOfAxisValues).keys()]

    const timeValues = data.map(d => d.endTime)
    const maxTime = Math.ceil(timeValues[timeValues.length - 1])
    console.log(maxTime)
    const minTime = Math.ceil(timeValues[0])
    console.log(minTime)
    const intervalSize = (maxTime - minTime) / numberOfAxisValues
    console.log(intervalSize)

    const timeAxisValues = desiredAxisItems.map(a => minTime + (a + 1) * intervalSize)
    console.log(timeAxisValues)
    return timeAxisValues
  }

  render() {
    const { data, height, showLegend, legend, legendClick, title, showAxis } = this.props
    const displayData = this.proportionateValues()
    const timeAxisValues = this.renderTimeAxis(data)

    return (
      <div className="Gauge">
        <Stack
          className="gaugeHeader"
          fullWidth
          verticalType={Stack.VERTICAL_TYPE.CENTER}
        >
          <StackItem grow>
            <h4>{title}</h4>
          </StackItem>
        </Stack>

        <div className="Gauge-gauge" style={{ height: height }}>
          {displayData &&
            displayData.map((display, idx) => {
              return (
                <GaugeDataValue
                  key={idx + display.label}
                  index={idx}
                  displayData={display}
                  data={data}
                />
              )
            })}
        </div>

        {showAxis && (
          <Stack
            directionType={Stack.DIRECTION_TYPE.HORIZONTAL_TYPE}
            verticalType={Stack.VERTICAL_TYPE.CENTER}
            className="gaugeTimeline"
          >
            <StackItem className="gaugeTimelineItem" key={0}>
              {0}
            </StackItem>
            {timeAxisValues.map((v, index) => {
              return (
                <StackItem className="gaugeTimelineItem" shrink key={v + index}>
                  {v}
                </StackItem>
              )
            })}
          </Stack>
        )}

        {showLegend && (
          <div className="Gauge-legend">
            {legend.length > 0 &&
              legend.map((item, idx) => {
                return (
                  <GaugeDataLegendItem
                    key={idx + item.group.name}
                    legend={item}
                    click={legendClick}
                  />
                )
              })}
          </div>
        )}
      </div>
    )
  }
}
