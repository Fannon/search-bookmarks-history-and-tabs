describe('Tag View', () => {
  beforeEach(() => {
    cy.visit('/#tags/')
  })

  describe('Initializing Phase', () => {
    it('successfully loads', () => {
      cy.get('#tags-overview').find('#tags-list')
    })
    it('contains a list of tags', () => {
      cy.get('#tags-overview').find('#tags-list').find('[x-tag=json]').checkNoErrors()
    })
    it('can use tags for navigation', () => {
      cy.get('#tags-overview')
        .find('#tags-list')
        .find('[x-tag=json]')
        .click()
        .get('#search-input')
        .should('have.value', '#json')
        .get('#result-list')
        .should('not.have.length', 0)
        .find('[x-original-id=9]')
        .get('#result-list')
        .find('li.bookmark')
        .checkNoErrors()
    })
  })
})
