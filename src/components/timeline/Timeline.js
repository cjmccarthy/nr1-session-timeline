import React from 'react'
import { Stack, StackItem, Spinner } from 'nr1'
import Gauge from '../gauge/Gauge'
import eventGroup from './EventGroup'

export default class Timeline extends React.PureComponent {
  buildGauges(data) {
    //console.log(data);
    const playerEvents = []
    const requestEvents = []
    const cdnEvents = []

    let prevPlayerEvent = null
    let prevRequestEvent = null
    let prevCdnEvent = null

    let playerActive = false
    let requestActive = false
    let cdnActive = false

    let playerStartTime = null
    let requestStartTime = null
    let cdnStartTime = null

    let globalStartTime = null

    data.forEach(result => {
      const sessionGroup = eventGroup(result.eventAction)

      if (sessionGroup.name === 'DATAZOOM') {
        if (!prevPlayerEvent) {
          prevPlayerEvent = result
          playerStartTime = result.timestamp

          if(!globalStartTime) {
            globalStartTime = result.timestamp
          } else {
            this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, playerEvents)
          }
        } else if (!playerActive) {
          this.addEmptySpace(globalStartTime, result.timestamp, prevPlayerEvent.timestamp, playerEvents)
        }

        if (result.actionName === 'buffer_start') {
          playerActive = true
          this.addToTimeline(globalStartTime, result.timestamp, result.timestamp, sessionGroup, playerEvents)
        } else if (result.actionName === 'buffer_end') {
          this.addToTimeline(globalStartTime, result.timestamp, prevPlayerEvent.timestamp, sessionGroup, playerEvents)
          playerActive = false
        } else {
          this.addToTimeline(globalStartTime, result.timestamp, result.timestamp, sessionGroup, playerEvents)
        }


        prevPlayerEvent = result

      } else if (sessionGroup.name === 'HTTP_REQUEST') {
        if (!prevRequestEvent) {
          prevRequestEvent = result
          requestStartTime = result.start

          if(!globalStartTime) {
            globalStartTime = result.timestamp
          } else {
            this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, requestEvents)
          }
        } else if (!requestActive) {
          this.addEmptySpace(globalStartTime, result.timestamp, prevRequestEvent.timestamp, requestEvents)
        }

        this.addToTimeline(globalStartTime, result.end, result.start, sessionGroup, requestEvents)

        prevRequestEvent = result

      } else if (sessionGroup.name === 'CDN') {
        if (!prevCdnEvent) {
          prevCdnEvent = result
          cdnStartTime = result.timestamp

          if(!globalStartTime) {
            globalStartTime = result.timestamp
          } else {
            this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, cdnEvents)
          }
        } else if (!cdnActive) { 
          this.addEmptySpace(globalStartTime, result.timestamp, prevCdnEvent.timestamp, cdnEvents)
        }

        this.addToTimeline(globalStartTime, result.timestap + result.time_to_last_byte_ms, result.timestamp, sessionGroup,  cdnEvents)

        prevCdnEvent = result
      }
    })

    const maxTime = Math.max(prevPlayerEvent.timestamp, prevRequestEvent.timestamp, prevCdnEvent.timestamp)
    console.log(prevPlayerEvent.timestamp, prevRequestEvent.timestamp, prevCdnEvent.timestamp)
    console.log(maxTime)

    if (prevPlayerEvent.timestamp != maxTime) {
      this.addEmptySpace(globalStartTime, maxTime, prevPlayerEvent.timestamp, playerEvents)
    }

    if (prevRequestEvent.timestamp != maxTime) {
      console.log('Filling Request')
      console.log(maxTime - prevRequestEvent.end)
      this.addEmptySpace(globalStartTime, maxTime, prevRequestEvent.end, requestEvents)
    }

    if (prevCdnEvent.timestamp != maxTime) {
      console.log('Filling CDN')
      console.log(maxTime - prevCdnEvent.timestamp)
      this.addEmptySpace(globalStartTime, maxTime, prevCdnEvent.timestamp+prevCdnEvent.time_to_last_byte_ms, cdnEvents)
    }

    return [playerEvents, requestEvents, cdnEvents]
  }

  addToTimeline(globalStartTime, endTime, startTime, sessionGroup, timeline) {
    const value = endTime - startTime
    const eventStreamItem = {
      label: sessionGroup.timelineDisplay.label,
      value: value > 0 ? value : 1,
      color: sessionGroup.timelineDisplay.color,
      timeSinceStart: this.getSecondsSinceStart(globalStartTime, startTime),
    }

    timeline.push(eventStreamItem)
  }

  addEmptySpace(globalStartTime, endTime, startTime, timeline) {
    const value = endTime - startTime
    const emptySpace = {
      label: 'empty',
      value: value > 0 ? value : 1,
      color: '#FFFFFF',
      timeSinceStart: this.getSecondsSinceStart(globalStartTime, endTime)
      // warnings: result['nr.warnings'] ? result['nr.warnings'] : false,
    }
    timeline.push(emptySpace)
  }


  getSecondsSinceStart = (start, current) => {
    return (current - start) / 1000
  }

  render() {
    const { data, loading, legend, legendClick, showWarningsOnly } = this.props

    const streams = this.buildGauges(data)

    const gaugeContent = loading ? (
      <Spinner />
    ) : !loading && streams.length > 0 ? (
      <Stack
        fullWidth
        directionType={Stack.DIRECTION_TYPE.VERTICAL}
        verticalType={Stack.VERTICAL_TYPE.CENTER}
        horizontalType={Stack.HORIZONTAL_TYPE.FILL}
      >
        <StackItem grow >
          <Gauge
            data={streams[0] }
            height={25}
            showLegend={false}
            showAxis={false}
            legend={legend}
            legendClick={legendClick}
            showWarningsOnly={showWarningsOnly}
            title='Player Events'
          />
        </StackItem>
        <StackItem grow >
          <Gauge
            data={streams[1] }
            height={25}
            showLegend={false}
            showAxis={false}
            legend={legend}
            legendClick={legendClick}
            showWarningsOnly={showWarningsOnly}
            title='Requests'
          />
        </StackItem>
        <StackItem grow >
          <Gauge
            data={streams[2] }
            height={25}
            showLegend={true}
            showAxis={true}
            legend={legend}
            legendClick={legendClick}
            showWarningsOnly={showWarningsOnly}
            title='CDN Logs'
          />
        </StackItem>
      </Stack>
    ) : (
      <Stack
        fullWidth
        className="emptyState timelineEmptyState"
        directionType={Stack.DIRECTION_TYPE.VERTICAL}
        verticalType={Stack.VERTICAL_TYPE.CENTER}
        horizontalType={Stack.HORIZONTAL_TYPE.CENTER}
      >
        <StackItem>
          <p className="emptyStateHeader">Could not load session timeline</p>
        </StackItem>
      </Stack>
    )

    return (
      <div>
        <Stack
          className="gaugeStack"
          directionType={Stack.DIRECTION_TYPE.VERTICAL}
        >
          <StackItem className="gaugeStackItem sessionSectionBase">
            {gaugeContent}
          </StackItem>
        </Stack>
      </div>
    )
  }
}
