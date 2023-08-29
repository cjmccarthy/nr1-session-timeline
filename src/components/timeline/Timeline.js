import React from 'react'
import { Stack, StackItem, Spinner } from 'nr1'
import Gauge from '../gauge/Gauge'
import eventGroup from './EventGroup'

export default class Timeline extends React.PureComponent {
  buildGauges(data) {
    //console.log(data);
    const playerEvents = []
    //[[], last timestamp, buffering]
    const requestEvents = []
    //[[], last timestamp]
    const cdnEvents = []
    //[[], last timestamp]
    const ridColors = {}

    var currentPlayerLine = 0
    var currentRequestLine = 0
    var currentCdnLine = 0

    var globalStartTime = null
    var globalMaxTime = 0

    const overlapProtectionMs = 500

    data.forEach(result => {
      const sessionGroup = eventGroup(result.eventAction)

      if (sessionGroup.name === 'DATAZOOM') {
        if(!globalStartTime) {
          globalStartTime = result.timestamp
        } 

        if (result.timestamp > globalMaxTime) {
          globalMaxTime = result.timestamp
        }

        if (playerEvents.length == 0) {
          playerEvents.push({ events : [], lastTimestamp : globalStartTime, buffering : false})
          if (globalStartTime != result.timestamp) {
            this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, playerEvents[0].events)
            //TODO: -1 hack to try to not init 2 rows on first run
            playerEvents[0].lastTimestamp = result.timestamp-1
          }
        } 

        //need to search all lines for the buffering one and reset to lowest open
        if (result.actionName === 'buffer_end')
        {
          //search for buffering event line
          playerEvents.forEach((result, line) => {
            if (playerEvents[line].buffering) {
              currentPlayerLine = line
            }
          })
          //fill it with color instead of space
          this.addToTimeline(globalStartTime, result.timestamp, playerEvents[currentPlayerLine].lastTimestamp, sessionGroup, playerEvents[currentPlayerLine].events)
          //toggle buffer state
          playerEvents[currentPlayerLine].buffering = false
          playerEvents[currentPlayerLine].lastTimestamp = result.timestamp + overlapProtectionMs

        } else {
          //search for the first available line
          var availableLine = -1
          playerEvents.forEach((lineData, line) => {
            //current event is after the last event on a line and that line is not buffering
            console.log(playerEvents[line].lastTimestamp)
            console.log(result)
            if ((playerEvents[line].lastTimestamp < result.timestamp) && !playerEvents[line].buffering) {
              availableLine = line
            }
          })
          //if none is available, create a new line
          if (availableLine == -1) {
            playerEvents.push({ events : [], lastTimestamp : globalStartTime, buffering : false})
            currentPlayerLine = playerEvents.length-1
            //fill with empty space from the beginning
            this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, playerEvents[currentPlayerLine].events)
          } else {
            currentPlayerLine = availableLine
            //TODO: check if this inserts extra whitespace on first event
            this.addEmptySpace(globalStartTime, result.timestamp, playerEvents[currentPlayerLine].lastTimestamp, playerEvents[currentPlayerLine].events)
          }
          playerEvents[currentPlayerLine].lastTimestamp = result.timestamp + overlapProtectionMs
          this.addToTimeline(globalStartTime, result.timestamp, result.timestamp, sessionGroup, playerEvents[currentPlayerLine].events)

          if (result.actionName === 'buffer_start') {
            playerEvents[currentPlayerLine].buffering = true
          }
        }

      } else if (sessionGroup.name === 'HTTP_REQUEST') {
        if(!globalStartTime) {
          globalStartTime = result.timestamp
        } 
        if (result.end > globalMaxTime) {
          globalMaxTime = result.end
        }

        if (requestEvents.length == 0) {
          requestEvents.push({ events : [], lastTimestamp : globalStartTime})
          if (globalStartTime != result.timestamp) {
            this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, requestEvents[0].events)
            //TODO: -1 hack to try to not init 2 rows on first event
            requestEvents[0].lastTimestamp = result.timestamp-1
          }
        } 

        let availableLine = -1
        requestEvents.forEach((lineData, line) => {
          //current event is after the last event on a line
          if (requestEvents[line].lastTimestamp < result.timestamp ) {
            availableLine = line
          }
        })
        //if none is available, create a new line
        if (availableLine == -1) {
            requestEvents.push({ events : [], lastTimestamp : globalStartTime})
            currentRequestLine = requestEvents.length-1
            //fill with empty space from the beginning
            this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, requestEvents[currentRequestLine].events)
        } else {
          currentRequestLine = availableLine
          //TODO: check if this inserts extra whitespace on first event
          this.addEmptySpace(globalStartTime, result.timestamp, requestEvents[currentRequestLine].lastTimestamp, requestEvents[currentRequestLine].events)
        }
        requestEvents[currentRequestLine].lastTimestamp = result.end + overlapProtectionMs
        this.addToTimeline(globalStartTime, result.end, result.timestamp, sessionGroup, requestEvents[currentRequestLine].events)
 
      } else if (sessionGroup.name === 'CDN') {
        if(!globalStartTime) {
          globalStartTime = result.timestamp
        } 
        if (result.timestamp > globalMaxTime) {
          globalMaxTime = result.timestamp
        }

        if (cdnEvents.length == 0) {
          cdnEvents.push({ events : [], lastTimestamp : globalStartTime})
          if (globalStartTime != result.timestamp) {
            this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, cdnEvents[0].events)
            //TODO: -1 hack to try to not init 2 rows on first event
            cdnEvents[0].lastTimestamp = result.timestamp-1
          }
        } 

        let availableLine = -1
        cdnEvents.forEach((lineData, line) => {
          //current event is after the last event on a line
          if (cdnEvents[line].lastTimestamp < result.timestamp ) {
            availableLine = line
          }
        })
        //if none is available, create a new line
        if (availableLine == -1) {
            cdnEvents.push({ events : [], lastTimestamp : globalStartTime})
            currentCdnLine = cdnEvents.length-1
            //fill with empty space from the beginning
            this.addEmptySpace(globalStartTime, result.timestamp, globalStartTime, cdnEvents[currentCdnLine].events)
        } else {
          currentCdnLine = availableLine
          //TODO: check if this inserts extra whitespace on first event
          this.addEmptySpace(globalStartTime, result.timestamp, cdnEvents[currentCdnLine].lastTimestamp, cdnEvents[currentCdnLine].events)
        }
        cdnEvents[currentCdnLine].lastTimestamp = result.timestamp + result.time_to_last_byte_ms
        this.addToTimeline(globalStartTime, result.time_to_last_byte_ms, result.timestamp, sessionGroup, cdnEvents[currentCdnLine].events)
      }
      
    })

    playerEvents.forEach(line => {
      if (line.lastTimestamp < globalMaxTime) {
        this.addEmptySpace(globalStartTime, globalMaxTime, line.lastTimestamp, line.events)
      }
    })
    requestEvents.forEach(line => {
      if (line.lastTimestamp < globalMaxTime) {
        this.addEmptySpace(globalStartTime, globalMaxTime, line.lastTimestamp, line.events)
      }
    })
    cdnEvents.forEach(line => {
      if (line.lastTimestamp < globalMaxTime) {
        this.addEmptySpace(globalStartTime, globalMaxTime, line.lastTimestamp, line.events)
      }
    })

    return [playerEvents, requestEvents, cdnEvents]
  }

  addToTimeline(globalStartTime, endTime, startTime, sessionGroup, timeline) {
    const value = endTime - startTime
    const eventStreamItem = {
      label: sessionGroup.timelineDisplay.label,
      value: value > 0 ? value : 1,
      color: sessionGroup.timelineDisplay.color,
      endTime: endTime,
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
      endTime: endTime,
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
        spacingType={Stack.SPACING_TYPE.OMIT}
        gapType={Stack.GAP_TYPE.NONE}
      >
        {streams[0].map(line => { return (
          <StackItem grow fullWidth shrink>
            <Gauge
              data={line.events }
              height={20}
              showLegend={false}
              showAxis={false}
              legend={legend}
              legendClick={legendClick}
              showWarningsOnly={showWarningsOnly}
              // title='Player Events'
            />
          </StackItem>
        )})}
        {streams[1].map(line => { return (
          <StackItem grow fullWidth shrink>
            <Gauge
              data={line.events }
              height={20}
              showLegend={false}
              showAxis={false}
              legend={legend}
              legendClick={legendClick}
              showWarningsOnly={showWarningsOnly}
              // title='Request Events'
            />
          </StackItem>
        )})}
        {streams[2].map((line, index) => { return (
          <StackItem grow fullWidth shrink >
            <Gauge
              data={line.events}
              height={20}
              showLegend={streams[2].length -1 == index}
              showAxis={streams[2].length -1 == index}
              legend={legend}
              legendClick={legendClick}
              showWarningsOnly={showWarningsOnly}
              // title='CDN Events'
            />
          </StackItem>
        )})}
        {/* <StackItem grow >
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
        </StackItem> */}
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
