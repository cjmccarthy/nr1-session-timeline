import React from 'react'
import PropTypes from 'prop-types'
import { NrqlQuery, HeadingText, Stack, StackItem, Spinner, Button, TextField } from 'nr1'
import sortBy from 'lodash.sortby'
import cloneDeep from 'lodash.clonedeep'
import EventStream from './EventStream'
import Timeline from './Timeline'
import eventGroup from './EventGroup'
import { withConfigContext } from '../../context/ConfigContext'

export default class TimelineContainer extends React.Component {
  state = {
    sessionData: [],
    loading: true,
    legend: [],
    warnings: false,
    warningCount: 0,
    showWarningsOnly: false,
    startTime: 0,
    endTime: 120000,
  }

  constructor(props) {
    super(props)

    this.setFilter = this.setFilter.bind(this)
  }

  async componentDidUpdate() {
    const { loading } = this.state
    if (loading) {
      const {
        config: { timelineEventTypes },
      } = this.props

      const selectedEventTypes = timelineEventTypes.filter(
        event => event.selected
      )
      if (selectedEventTypes) {
        const linkingAttributeClause = await this.getLinkingClause()
        let data = []
        let warnings = false
        let warningCount = 0

        for (let eventType of selectedEventTypes) {
          const { result, totalWarnings } = await this.getData(
            eventType.name,
            linkingAttributeClause
          )

          data = data.concat(result)

          if (totalWarnings > 0) {
            warnings = true
            warningCount += totalWarnings
          }
        }

        data = data.filter(Boolean)
        data = sortBy(data, 'timestamp')
        console.log(data[0])
        console.log(data[1])
        // const maxTime = data[-1].timestamp
        // const minTime = data[0].timestamp
        // data = data.filter((d) => d.timestamp < minTime + 120000)

        const legend = this.getLegend(data)
        this.setState({
          sessionData: data,
          loading: false,
          legend,
          warnings,
          warningCount,
          showWarningsOnly: false,
        })
      }
    }
  }

  getData = async (eventType, linkingAttributeClause) => {
    const { entityGuid: guid, accountId, sessionDate, duration } = this.props

    var query;
    query = `SELECT * from ${eventType} WHERE entityGuid = '${guid}' and dateOf(timestamp) = '${sessionDate}' and ${linkingAttributeClause} ORDER BY timestamp ASC LIMIT MAX ${duration.since}`

    const { data } = await NrqlQuery.query({ accountIds: [accountId], query })

    const seenRids = []
    let totalWarnings = 0
    let result = []
    if (data && data.length > 0)
      result = data[0].data.map(event => {
        event['eventType'] = eventType
        event['eventAction'] = this.getEventAction(event, eventType)

        const warnings = this.getWarningConditions(event, eventType)
        if (warnings && warnings.length > 0) {
          event['nr.warnings'] = true
          event['nr.warningConditions'] = warnings
          totalWarnings++
        }

        return event
      })

    return { result, totalWarnings }
  }

  getLinkingClause = async () => {
    const {
      entityGuid: guid,
      accountId,
      filter,
      session,
      sessionDate,
      duration,
      config: {
        rootEvent: event,
        searchAttribute,
        groupingAttribute,
        linkingAttribute,
      },
    } = this.props

    let attributeClause = `(${groupingAttribute} = '${session}' and ${searchAttribute} = '${filter}')  OR sid = '${filter}'`
    if (linkingAttribute) {
      const query = `SELECT uniques(${linkingAttribute}) from ${event} WHERE entityGuid = '${guid}' and dateOf(timestamp) = '${sessionDate}' and ${groupingAttribute} = '${session}' AND ${searchAttribute} = '${filter}' LIMIT MAX ${duration.since}`

      const { data } = await NrqlQuery.query({ accountIds: [accountId], query })

      const links = []
      if (data && data.length > 0)
        data[0].data.forEach(event => links.push(event[linkingAttribute]))

      if (links && links.length > 0) {
        let linkedClause = `${linkingAttribute} IN (`
        links.forEach((link, index) => {
          linkedClause += `'${link}'`
          if (index + 1 < links.length) linkedClause += ','
        })
        linkedClause += ')'
        attributeClause = linkedClause
      }
    }

    return attributeClause
  }

  getWarningConditions = (event, eventType) => {
    const {
      config: { eventThresholds },
    } = this.props
    const thresholds = eventThresholds.filter(
      threshold => threshold.eventType === eventType
    )

    let warnings = []
    if (thresholds && thresholds.length > 0) {
      for (let {
        categoryAttribute,
        categoryValue,
        attribute,
        threshold,
      } of thresholds[0].thresholds) {
        if (
          !categoryAttribute ||
          (categoryAttribute && event[categoryAttribute] === categoryValue)
        ) {
          if (event[attribute] > threshold) {
            const actual = event[attribute]
            warnings.push({ attribute, threshold, actual })
          }
        }
      }
    }
    return warnings
  }

  getEventAction = (event, eventType) => {
    let action = ''
    if (eventType !== 'BrowserInteraction') action = eventType
    else
      action =
        event.category === 'Custom' ? 'Custom Interaction' : event.category

    return action
  }


  getLegend = data => {
    const legend = []
    for (let row of data) {
      const group = eventGroup(row.eventAction)
      const found = legend.filter(item => item.group.name === group.name)

      if (found.length === 0) {
        legend.push({ group, visible: true })
      }
    }

    return legend
  }

  onChangeStartTime = event => {
    let startTime = parseInt(event.target.value, 10)
    if (startTime !== NaN && startTime >= 0) {
      this.setState({startTime})
    }
  }

  onChangeEndTime = event => {
    let endTime = parseInt(event.target.value, 10)
    if (endTime !== NaN) {
      const newEnd = Math.min(endTime, 120000)
      this.setState({endTime : newEnd})
    }
    
  }

  onClickLegend = legendItem => {
    const legend = cloneDeep(this.state.legend)

    let hiddenCount = 0

    legend.forEach(item => {
      if (item.group.name !== legendItem.group.name && !item.visible)
        hiddenCount++
    })

    if (legendItem.visible && hiddenCount === 0) {
      legend.forEach(item => {
        if (item.group.name !== legendItem.group.name) item.visible = false
      })
    } else if (legendItem.visible && hiddenCount === legend.length - 1) {
      legend.forEach(item => {
        if (item.group.name !== legendItem.group.name) item.visible = true
      })
    } else {
      for (let item of legend) {
        if (item.group.name === legendItem.group.name) {
          item.visible = !legendItem.visible
          break
        }
      }
    }

    this.setState({ legend })
  }

  onToggleWarnings = () => {
    const { showWarningsOnly } = this.state
    this.setState({ showWarningsOnly: !showWarningsOnly })
  }

  setFilter = (startTime, endTime) => {
    console.log('resetting filter')
    console.log(startTime)
    console.log(endTime)
    this.setState({startTime, endTime})
  }

  setFilterE = (e, startTime, endTime) => {
    e.preventDefault()
    this.setFilter(startTime,endTime)
  }

  render() {
    const {
      sessionData,
      loading,
      legend,
      warnings,
      warningCount,
      showWarningsOnly,
      startTime,
      endTime
    } = this.state
    const { session, sessionDate, filter, config } = this.props

    return (
      <React.Fragment>
        {!session && (
          <div className="timeline-container">
            <div className="empty-state">
              <HeadingText
                className="empty-state-header"
                type={HeadingText.TYPE.HEADING_3}
              >
                Pick a session to continue
              </HeadingText>
              <div className="empty-state-desc">
                To view the timeline breakdown of a specific session, please
                click on a line item in the chart to the left.
              </div>
            </div>
          </div>
        )}
        {session && loading && (
          <div className="timeline-container">
            <Spinner />
          </div>
        )}
        {session && !loading && (
          <Stack
            directionType={Stack.DIRECTION_TYPE.VERTICAL}
            horizontalType={Stack.HORIZONTAL_TYPE.CENTER}
            fullHeight
            fullWidth
            className="timeline-container"
          >
            <StackItem className="timeline__stack-item stack__header">
              <TextField 
                description="Start Time (ms)" 
                placeholder="e.g 0" 
                defaultValue='0'
                onChange={this.onChangeStartTime}
                value={startTime}
              />
              <TextField 
                description="End Time (ms)" 
                placeholder="e.g 5124"
                value={endTime}
                onChange={this.onChangeEndTime}
              />
              <Button
                onClick={(e) => this.setFilterE(e, 0, Number.MAX_SAFE_INTEGER)}
              >
                Reset Filters
              </Button>
            </StackItem>
            <StackItem className="timeline__stack-item stack__header">
              <div>
                <HeadingText type={HeadingText.TYPE.HEADING_3}>
                  Viewing Session {session} for {filter} ({sessionDate})
                </HeadingText>
              </div>
            </StackItem>
            <StackItem grow className="timeline__stack-item">
              <Timeline
                data={sessionData}
                loading={loading}
                legend={legend}
                legendClick={this.onClickLegend}
                showWarningsOnly={showWarningsOnly}
                filterStartTime={startTime}
                filterEndTime={endTime}
              />
              {warnings && (
                <div className="timline__warning">
                  <div className="timeline__warning-alert">
                    We found {warningCount} segment(s) that violated expected
                    performance thresholds.
                  </div>
                  <Button
                    className="timeline__warning-button"
                    onClick={this.onToggleWarnings}
                  >
                    {showWarningsOnly && 'Show all events'}
                    {!showWarningsOnly && 'Show violations only'}
                  </Button>
                </div>
              )}
              <EventStream
                data={sessionData}
                loading={loading}
                legend={legend}
                showWarningsOnly={showWarningsOnly}
                config={config}
                filterStartTime={startTime}
                filterEndTime={endTime}
                setFilter={this.setFilter}
              />
            </StackItem>
          </Stack>
        )}
      </React.Fragment>
    )
  }
}

TimelineContainer.propTypes = {
  session: PropTypes.string.isRequired,
  sessionDate: PropTypes.string.isRequired,
  filter: PropTypes.string.isRequired,
  duration: PropTypes.object.isRequired,
}

// export default withConfigContext(TimelineContainer)
