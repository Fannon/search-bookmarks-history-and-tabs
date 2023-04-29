const interactionTime = 100
const initTime = 400

describe('Search View', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  describe('Initializing Phase', () => {
    it('successfully loads', () => {
      cy.get('#result-list').should('have.length', 1).find('#results-loading')
    })
    it('completes the initializing phase without errors', () => {
      cy.wait(initTime).get('#results-loading').should('not.exist').checkNoErrors()
    })
    it('starts with no results', () => {
      cy.get('#result-counter').contains('(0)')
    })
  })

  describe('Result Navigation', () => {
    it('first result is highlighted', () => {
      cy.get('#search-input')
        .type(`JSON Edit`)
        .get('#result-list li')
        .each((el, index) => {
          if (index === 0) {
            expect(el[0].id).to.equal('selected-result')
          } else {
            expect(el[0].id).to.not.equal('selected-result')
          }
        })
        .get('#search-input')
        .type('{downarrow}')
        .get('#result-list li')
        .each((el, index) => {
          if (index === 1) {
            expect(el[0].id).to.equal('selected-result')
          } else {
            expect(el[0].id).to.not.equal('selected-result')
          }
        })
        .get('#search-input')
        .type('{uparrow}')
        .get('#result-list li')
        .each((el, index) => {
          if (index === 0) {
            expect(el[0].id).to.equal('selected-result')
          } else {
            expect(el[0].id).to.not.equal('selected-result')
          }
        })
        .checkNoErrors()
    })
  })

  describe('Search result item', () => {
    it('includes everything expected (title, URL etc.)', () => {
      cy.get('#search-input')
        .type(`JSON`)
        .get('#result-list')
        .find('[x-original-id=9]')

        // Check that we have a result with a title returned
        .get('[x-original-id=9]')
        .find('.title')
        .contains('JSON')

        // Check that we have a result with an URL returned
        .get('[x-original-id=9]')
        .find('.url')
        .contains('json')

        // expect #json tag
        .get('[x-original-id=9]')
        .find('span.tags')
        .contains('#json')

        // expect ~Tools folder
        .get('[x-original-id=9]')
        .find('span.folder')
        .contains('~Tools')

        // expect lastVisited badge
        .get('[x-original-id=9]')
        .find('span.last-visited')

        // expect score badge
        .get('[x-original-id=9]')
        .find('span.score')

        .checkNoErrors()
    })
  })

  describe('Precise search', () => {
    it('can execute a precise search successfully', () => {
      cy.get('#search-approach-toggle')
        .get('#search-input')
        .type(`JSON`)
        .wait(initTime)
        // Make sure we get result of all types
        .get('#result-list')
        .should('not.have.length', 0)
        .find('[x-original-id=9]')
        .get('#result-list')
        .find('li.bookmark')
        .get('#result-list')
        .find('li.history')
        .get('#result-list')
        .find('li.tab')
        .get('#result-list')
        .find('li.bookmark')
        .checkNoErrors()
    })
    it('can execute a precise search with non-ASCII chars successfully', () => {
      cy.get('#search-approach-toggle')
        .get('#search-input')
        .type(`äe指事字₽`)
        .wait(initTime)
        // Only make sure that search doesn't crash
        .get('#result-list')
        .should('not.have.length', 0)
        .checkNoErrors()
    })
  })

  describe('Fuzzy search', () => {
    it('can switch to fuzzy search successfully', () => {
      cy.get('#search-approach-toggle')
        .wait(interactionTime)
        .contains('PRECISE')
        .click()
        .wait(interactionTime)
        .contains('FUZZY')
        .get('#search-input')
        .type(`JSON`)
        .get('li.bookmark')
        .checkNoErrors()
    })

    it('can execute a fuzzy search successfully', () => {
      cy.get('#search-approach-toggle')
        .wait(interactionTime)
        .contains('PRECISE')
        .click()
        .wait(interactionTime)
        .contains('FUZZY')
        .wait(interactionTime)
        .get('#search-input')
        .type(`JSON`)
        .get('li.bookmark')
        .get('#result-list')
        .should('not.have.length', 0)
        .find('[x-original-id=9]')
        // Check that we have all kinds of results
        .get('#result-list')
        .find('li.bookmark')
        .get('#result-list')
        .find('li.history')
        .get('#result-list')
        .find('li.tab')
        .get('#result-list')
        .find('li.bookmark')
        .checkNoErrors()
    })
  })

  it('can execute a precise search with non-ASCII chars successfully', () => {
    cy.get('#search-approach-toggle')
      .wait(interactionTime)
      .contains('PRECISE')
      .click()
      .wait(interactionTime)
      .contains('FUZZY')
      .wait(interactionTime)
      .get('#search-input')
      .type(`äe指事字₽`)
      .wait(initTime)
      // Only make sure that search doesn't crash
      .get('#result-list')
      .should('not.have.length', 0)
      .checkNoErrors()
  })

  describe('Bookmark search', () => {
    it('Empty search returns recent bookmarks', () => {
      cy.get('#search-input')
        .type(`b `)
        .get('#result-list')
        .find('li.bookmark')
        .get('#result-list')
        .find('[x-original-id=9]')
        .get('.tab')
        .should('not.exist')
        .get('.history')
        .should('not.exist')
        .checkNoErrors()
    })
    it('returns only bookmark results', () => {
      cy.get('#search-input')
        .type(`b JSON`)
        .get('#result-list')
        .find('[x-original-id=9]')
        .get('.tab')
        .should('not.exist')
        .get('.history')
        .should('not.exist')
        .get('#result-counter')
        .contains('(5)')
        .checkNoErrors()
    })
  })

  describe('History search', () => {
    it('Empty search returns recent history', () => {
      cy.get('#search-input')
        .type(`h `)
        .get('#result-list')
        .find('li.history')
        .get('#result-list')
        .find('[x-original-id=9]')
        .get('.tab')
        .should('not.exist')
        .get('.bookmark')
        .should('not.exist')
        .checkNoErrors()
    })
    it('only the history results', () => {
      cy.get('#search-input')
        .type(`h JSON`)
        .get('#result-list')
        .find('[x-original-id=9]')
        .get('.tab')
        .should('not.exist')
        .get('.bookmark')
        .should('not.exist')
        .get('#result-counter')
        .contains('(3)')
        .checkNoErrors()
    })
  })

  describe('Tab search', () => {
    it('Empty search returns all open tabs', () => {
      cy.get('#search-input')
        .type(`t `)
        .get('#result-list')
        .find('li.tab')
        .get('#result-list')
        .find('[x-original-id=179]')
        .get('.bookmark')
        .should('not.exist')
        .get('.history')
        .should('not.exist')
        .checkNoErrors()
    })
    it('returns only the tab results', () => {
      cy.get('#search-input')
        .type(`t JSON`)
        .get('#result-list')
        .find('[x-original-id=185]')
        .get('#result-list')
        .should('have.length', 1)
        .get('.bookmark')
        .should('not.exist')
        .get('.history')
        .should('not.exist')
        .get('#result-counter')
        .contains('(1)')
        .checkNoErrors()
    })
  })
})
