require 'spec_helper'

describe BoardContent, :type => :model do
  describe "generate_defaults" do
    it 'should generate default values' do
      bc = BoardContent.new
      expect(bc.settings).to eq(nil)
      expect(bc.board_count).to eq(nil)
      bc.generate_defaults
      expect(bc.settings).to eq({'board_ids' => []})
      expect(bc.board_count).to eq(0)
      bc.settings['board_ids'] = ['', '', '']
      bc.generate_defaults
      expect(bc.board_count).to eq(3)
    end
  end

  describe "generate_from" do
    it "should generate a new content offload" do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      buttons = b1.settings['buttons']
      BoardContent.generate_from(b1)
      expect(b1.board_content).to_not eq(nil)
      expect(b1.board_content.settings['buttons']).to eq(buttons)
      expect(b1.board_content.settings['grid']).to eq({
        'rows'=> 2,
        'columns'=> 2,
        'order'=> [[1, 3], [2, 4]]
      })
      expect(b1.settings['buttons']).to eq([])
      expect(b1.settings['grid']).to eq(nil)
      expect(b1.settings['content_overrides']).to eq({})
    end

    it "should identically match the prior data" do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon', translations: {'fr' => {'label' => 'oui'}}},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      }, background: {
        image: 'pic',
        prompt: 'hello'
      }, intro: {
        sections: ['a', 'b']
      })
      buttons = b1.buttons
      grid = BoardContent.load_content(b1, 'grid')
      bg = BoardContent.load_content(b1, 'background')
      intro = BoardContent.load_content(b1, 'intro')
      trans = BoardContent.load_content(b1, 'translations')
      BoardContent.generate_from(b1)
      expect(b1.board_content).to_not eq(nil)
      expect(b1.board_content.settings['buttons']).to eq(buttons)
      expect(b1.board_content.settings['grid']).to eq({
        'rows'=> 2,
        'columns'=> 2,
        'order'=> [[1, 3], [2, 4]]
      })
      expect(b1.board_content.settings['intro']).to eq({
        "sections" => ["a", "b"]
      })
      expect(b1.board_content.settings['background']).to eq({
        "image" => "pic",
        "prompt" => "hello",
      })
      expect(b1.board_content.settings['translations']).to eq({
        "1" => {"fr"=>{"label"=>"oui"}}
      })
      expect(b1.settings['buttons']).to eq([])
      expect(b1.settings['grid']).to eq(nil)
      expect(b1.settings['content_overrides']).to eq({})      
      expect(buttons).to eq(b1.buttons)
      expect(grid).to eq(BoardContent.load_content(b1, 'grid'))
      expect(bg).to eq(BoardContent.load_content(b1, 'background'))
      expect(intro).to eq(BoardContent.load_content(b1, 'intro'))
      expect(trans).to eq(BoardContent.load_content(b1, 'translations'))
    end
  end

  describe "load_content" do
    it "should error on unknown attr" do
      expect{ BoardContent.load_content(nil, 'yas') }.to raise_error("unexpected attribute for loading, yas")
    end

    it "should load from board settings by default" do
      u = User.create
      b = Board.create(user: u)
      b.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      expect(BoardContent.load_content(b, 'buttons')).to eq(b.settings['buttons'])
      expect(BoardContent.load_content(b, 'grid')).to eq(b.settings['grid'])
      expect(BoardContent.load_content(b, 'intro')).to eq(b.settings['intro'])
    end

    it 'should load from content if available' do
      u = User.create
      b = Board.create(user: u)
      b.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      BoardContent.generate_from(b)
      expect(BoardContent.load_content(b, 'buttons')).to eq(b.board_content.settings['buttons'])
      expect(BoardContent.load_content(b, 'grid')).to eq(b.board_content.settings['grid'])
      expect(BoardContent.load_content(b, 'intro')).to eq(b.board_content.settings['intro'])
    end

    it 'should prioritize seettings over content' do
      u = User.create
      b = Board.create(user: u)
      b.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      BoardContent.generate_from(b)
      b.settings['buttons'] = [{id: 1, 'label' => 'asdf'}]
      expect(BoardContent.load_content(b, 'buttons')).to eq(b.settings['buttons'])
      expect(BoardContent.load_content(b, 'grid')).to eq(b.board_content.settings['grid'])
      expect(BoardContent.load_content(b, 'intro')).to eq(b.board_content.settings['intro'])
    end

    it 'should apply content_overrides to buttons if available' do
      u = User.create
      b = Board.create(user: u)
      b.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      BoardContent.generate_from(b)
      b.settings['content_overrides'] = {
        'buttons' => {
          '1' => {'label' => 'beggin'},
          '2' => {'vocalization' => 'cheese'},
          '3' => {'label' => nil}
        }
      }
      expect(BoardContent.load_content(b, 'buttons')).to eq([
        {'id' => 1, 'label' => 'beggin', "part_of_speech"=>"noun", "suggested_part_of_speech"=>"noun"},
        {'id' => 2, 'label' => 'cheddar', 'vocalization' => 'cheese', "part_of_speech"=>"noun", "suggested_part_of_speech"=>"noun"},
        {'id' => 3, "part_of_speech"=>"noun", "suggested_part_of_speech"=>"noun"},
        {'id' => 4, 'label' => 'sour cream', "part_of_speech"=>"noun", "suggested_part_of_speech"=>"noun"},
      ])
    end

    it 'should apply content_overrides to grid if available' do
      u = User.create
      b = Board.create(user: u)
      b.process(buttons: [
        {id: 1, label: 'bacon', translations: {'fr' => {'label' => 'oui'}}},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      }, background: {
        image: 'pic',
        prompt: 'hello'
      }, intro: {
        sections: ['a', 'b']
      })
      BoardContent.generate_from(b)
      b.settings['content_overrides'] = {
        'grid' => {
          'rows' => 4,
        }
      }
      expect(BoardContent.load_content(b, 'grid')).to eq({
        'rows' => 4,
        'columns' => 2,
        'order' => [[1, 3], [2, 4]]
      })
      b.generate_defaults
      expect(BoardContent.load_content(b, 'grid')).to eq({
        'rows' => 4,
        'columns' => 2,
        'order' => [[1, 3], [2, 4], [nil, nil], [nil, nil]]
      })
    end

    it 'should apply content_overrides to intro if available' do
      u = User.create
      b = Board.create(user: u)
      b.process(buttons: [
        {id: 1, label: 'bacon', translations: {'fr' => {'label' => 'oui'}}},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      }, background: {
        image: 'pic',
        prompt: 'hello'
      }, intro: {
        sections: ['a', 'b'],
        cool: true
      })
      BoardContent.generate_from(b)
      b.settings['content_overrides'] = {
        'intro' => {
          'cool' => nil,
          'best' => true
        }
      }
      expect(BoardContent.load_content(b, 'intro')).to eq({
        'sections'=> ['a', 'b'],
        'best'=> true
      })
    end

    it 'should apply content_overrides to background if available' do
      u = User.create
      b = Board.create(user: u)
      b.process(buttons: [
        {id: 1, label: 'bacon', translations: {'fr' => {'label' => 'oui'}}},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      }, background: {
        image: 'pic',
        prompt: 'hello'
      }, intro: {
        sections: ['a', 'b'],
        cool: true
      })
      BoardContent.generate_from(b)
      b.settings['content_overrides'] = {
        'background' => {
          'image' => nil,
          'best' => true
        }
      }
      expect(BoardContent.load_content(b, 'background')).to eq({
        'prompt'=> 'hello',
        'best'=> true
      })
    end

    it 'should apply content_overrides to translations if available' do
      u = User.create
      b = Board.create(user: u)
      b.process(buttons: [
        {id: 1, label: 'bacon', translations: {'fr' => {'label' => 'oui'}}},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      }, background: {
        image: 'pic',
        prompt: 'hello'
      }, intro: {
        sections: ['a', 'b'],
        cool: true
      })
      BoardContent.generate_from(b)
      b.settings['content_overrides'] = {
        'translations' => {
          'default' => 'es',
          '2' => {'fr' => {'label' => 'non'}}
        }
      }
      expect(BoardContent.load_content(b, 'translations')).to eq({
        'default' => 'es',
        '1' => {'fr' => {'label' => 'oui'}},
        '2' => {'fr' => {'label' => 'non'}}
    })
    end

    it 'should clear the value if the override value is nil' do
      u = User.create
      b = Board.create(user: u)
      b.process(buttons: [
        {id: 1, label: 'bacon', translations: {'fr' => {'label' => 'oui'}}},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      }, background: {
        image: 'pic',
        prompt: 'hello'
      }, intro: {
        sections: ['a', 'b'],
        cool: true
      })
      BoardContent.generate_from(b)
      b.settings['content_overrides'] = {
        'background' => {
          'image' => nil,
          'best' => true
        }
      }
      expect(BoardContent.load_content(b, 'background')).to eq({
        'prompt'=> 'hello',
        'best'=> true
      })

      b.settings['content_overrides'] = {
        'background' => nil
      }
      expect(BoardContent.load_content(b, 'background')).to eq(nil)
    end
  end

  describe "attach_as_clone" do
    it 'should do nothing without a parent board' do
      u = User.create
      b = Board.create(user: u)
      expect(b).to_not receive(:save!)
      BoardContent.attach_as_clone(b)
    end

    it 'should use an existing content object for the parent and diff against it' do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      BoardContent.generate_from(b1)
      expect(b1.board_content).to_not eq(nil)

      b2 = Board.create(user: u, parent_board: b1)
      b2.process({buttons: [
        {id: 1, label: 'bacon'},
        {id: 3, label: 'broccoli'},
        {id: 2, label: 'cheddar', vocalization: 'cheese'},
        {id: 4, label: 'sour cream', load_board: {id: b2.global_id, key: b2.key}},
      ], grid: {
        rows: 2,
        columns: 3,
        order: [[1, nil, 2], [3, 4, nil]]
      }}, {author: u})
      BoardContent.attach_as_clone(b2)
      expect(b1.board_content).to eq(b2.board_content)
      expect(b2.settings['buttons']).to eq([])
      expect(b2.settings['grid']).to eq(nil)
      expect(b2.settings['content_overrides']).to eq({
        'grid' => {
          'columns' => 3,
          'order' => [[1, nil, 2], [3, 4, nil]]
        },
        'buttons' => {
          '2' => {
            'vocalization' => 'cheese'
          },
          '4' => {
            'load_board' => { 'id' => b2.global_id, 'key' => b2.key}
          }
        }
      })
    end

    it 'should handle a completely different set of attributes' do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      BoardContent.generate_from(b1)
      expect(b1.board_content).to_not eq(nil)

      b2 = Board.create(user: u, parent_board: b1)
      b2.process({buttons: [
        {id: 1, label: 'whatever'},
        {id: 3, label: 'as if'},
        {id: 6, label: 'pshaw', vocalization: 'pushaw'},
        {id: 9, label: 'nevermind', load_board: {id: b2.global_id, key: b2.key}},
      ], grid: {
        rows: 2,
        columns: 3,
        order: [[1, nil, 2], [3, 4, nil]]
      }}, {author: u})
      BoardContent.attach_as_clone(b2)
      expect(b1.board_content).to eq(b2.board_content)
      expect(b2.settings['buttons']).to eq([])
      expect(b2.settings['grid']).to eq(nil)
      expect(b2.settings['content_overrides']).to eq({
        'grid' => {
          'columns' => 3,
          'order' => [[1, nil, 2], [3, 4, nil]]
        },
        'buttons' => {
          '1' => {
            'label' => 'whatever', "part_of_speech"=>"pronoun", "suggested_part_of_speech"=>"pronoun",
          },
          '3' => {
            'label' => 'as if', "part_of_speech"=>nil, "suggested_part_of_speech"=>nil,
          },
          '6' => {
            'id' => 6,
            'label' => 'pshaw',
            'vocalization' => 'pushaw'
          },
          '9' => {
            'id' => 9,
            'label' => 'nevermind', "part_of_speech"=>"noun", "suggested_part_of_speech"=>"noun",
            'load_board' => { 'id' => b2.global_id, 'key' => b2.key}
          }
        }
      })
    end

    it 'should not create an additional content object even if the parent board has content_overrides' do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      BoardContent.generate_from(b1)
      expect(b1.board_content).to_not eq(nil)
      b1.process(buttons: [
        {id: 1, label: 'bacony'},
        {id: 2, label: 'cheddared'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      expect(b1.settings['content_overrides']).to eq({
        'buttons' => {
          '1' => {
            'label' => 'bacony', "part_of_speech"=>nil, "suggested_part_of_speech"=>nil,
          },
          '2' => {
            'label' => 'cheddared', "part_of_speech"=>nil, "suggested_part_of_speech"=>nil,
          }
        }
      })

      b2 = Board.create(user: u, parent_board: b1)
      b2.process({buttons: [
        {id: 1, label: 'bacon'},
        {id: 3, label: 'broccoli'},
        {id: 2, label: 'cheddar', vocalization: 'cheese'},
        {id: 4, label: 'sour cream', load_board: {id: b2.global_id, key: b2.key}},
      ], grid: {
        rows: 2,
        columns: 3,
        order: [[1, nil, 2], [3, 4, nil]]
      }}, {author: u})
      BoardContent.attach_as_clone(b2)
      expect(b1.board_content).to eq(b2.board_content)
      expect(b2.settings['buttons']).to eq([])
      expect(b2.settings['grid']).to eq(nil)
      expect(b2.settings['content_overrides']).to eq({
        'grid' => {
          'columns' => 3,
          'order' => [[1, nil, 2], [3, 4, nil]]
        },
        'buttons' => {
          '2' => {
            'vocalization' => 'cheese'
          },
          '4' => {
            'load_board' => { 'id' => b2.global_id, 'key' => b2.key}
          }
        }
      })
    end
  end

  describe "apply_clone" do
    it 'should generate a new content object if none available' do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      expect(b1.reload.board_content).to eq(nil)
      BoardContent.apply_clone(b1, nil)      
      expect(b1.reload.board_content).to_not eq(nil)
      expect(b1.buttons.length).to eq(4)
      expect(b1.settings['buttons']).to eq([])
      expect(b1.buttons.map{|b| b.slice('id', 'label')}).to eq([
        {'id'=> 1, 'label'=> 'bacon'},
        {'id'=> 2, 'label'=> 'cheddar'},
        {'id'=> 3, 'label'=> 'broccoli'},
        {'id'=> 4, 'label'=> 'sour cream'},
      ])
    end

    it 'should generate a new content object if allowed and board has changes' do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      BoardContent.generate_from(b1)
      expect(b1.board_content).to_not eq(nil)
      bc = b1.board_content
      b1.process(buttons: [
        {id: 1, label: 'bacony'},
        {id: 2, label: 'cheddared'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      expect(b1.settings['content_overrides']).to eq({
        'buttons' => {
          '1' => {
            'label' => 'bacony', "part_of_speech"=>nil, "suggested_part_of_speech"=>nil,
          },
          '2' => {
            'label' => 'cheddared', "part_of_speech"=>nil, "suggested_part_of_speech"=>nil,
          }
        }
      })
      expect(BoardContent.has_changes?(b1, b1.board_content)).to eq(true)
      BoardContent.apply_clone(b1, nil)
      expect(b1.board_content).to_not eq(bc)
      expect(b1.settings['buttons']).to eq([])
      expect(b1.buttons.map{|b| b.slice('id', 'label')}).to eq([
        {'id'=> 1, 'label'=> 'bacony'},
        {'id'=> 2, 'label'=> 'cheddared'},
        {'id'=> 3, 'label'=> 'broccoli'},
        {'id'=> 4, 'label'=> 'sour cream'},
      ])
    end

    it 'should not generate a new content object if the changes atttributes exist but are empty' do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      BoardContent.generate_from(b1)
      expect(b1.board_content).to_not eq(nil)
      bc = b1.board_content
      b1.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      expect(b1.settings['content_overrides']).to eq({
      })
      expect(BoardContent.has_changes?(b1, b1.board_content)).to eq(false)
      BoardContent.apply_clone(b1, nil)
      expect(b1.board_content).to eq(bc)
    end

    it 'should not generate a new content object if not allowed, even if board has changes' do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      BoardContent.generate_from(b1)
      expect(b1.board_content).to_not eq(nil)
      bc = b1.board_content
      b1.process(buttons: [
        {id: 1, label: 'bacony'},
        {id: 2, label: 'cheddared'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      expect(b1.settings['content_overrides']).to eq({
        'buttons' => {
          '1' => {
            'label' => 'bacony', "part_of_speech"=>nil, "suggested_part_of_speech"=>nil,
          },
          '2' => {
            'label' => 'cheddared', "part_of_speech"=>nil, "suggested_part_of_speech"=>nil,
          }
        }
      })
      expect(BoardContent.has_changes?(b1, b1.board_content)).to eq(true)
      BoardContent.apply_clone(b1, nil, true)
      expect(b1.reload.board_content).to eq(bc)
      expect(b1.settings['content_overrides']).to eq({
        'buttons' => {
          '1' => {
            'label' => 'bacony', "part_of_speech"=>nil, "suggested_part_of_speech"=>nil
          },
          '2' => {
            'label' => 'cheddared', "part_of_speech"=>nil, "suggested_part_of_speech"=>nil
          }
        }
      })
      expect(b1.settings['buttons']).to eq(nil)
      expect(b1.buttons.map{|b| b.slice('id', 'label')}).to eq([
        {'id'=> 1, 'label'=> 'bacony'},
        {'id'=> 2, 'label'=> 'cheddared'},
        {'id'=> 3, 'label'=> 'broccoli'},
        {'id'=> 4, 'label'=> 'sour cream'},
      ])
    end

    it 'should apply the content object to the copy and track differences' do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      BoardContent.generate_from(b1)
      expect(b1.board_content).to_not eq(nil)
      bc = b1.board_content
      b1.process(buttons: [
        {id: 1, label: 'bacony'},
        {id: 2, label: 'cheddared'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      expect(b1.settings['content_overrides']).to eq({
        'buttons' => {
          '1' => {
            'label' => 'bacony', "part_of_speech"=>nil, "suggested_part_of_speech"=>nil,
          },
          '2' => {
            'label' => 'cheddared', "part_of_speech"=>nil, "suggested_part_of_speech"=>nil,
          }
        }
      })
      expect(BoardContent.has_changes?(b1, b1.board_content)).to eq(true)
      b2 = Board.create(user: u)
      b2.process(buttons: [
        {id: 1, label: 'bacony'},
        {id: 2, label: 'cheddared'},
        {id: 3, label: 'cauliflower'},
        {id: 5, label: 'cream of chicken'},
      ], grid: {
        rows: 3,
        columns: 2,
        order: [[1, 3], [5, 2], [nil, nil]]
      })      
      BoardContent.apply_clone(b1, b2)
      expect(b1.board_content).to_not eq(bc)
      expect(b1.board_content).to eq(b2.board_content)
      expect(b2.settings['buttons']).to eq(nil)
      expect(b2.buttons.map{|b| b.slice('id', 'label')}).to eq([
        {'id'=> 1, 'label'=> 'bacony'},
        {'id'=> 2, 'label'=> 'cheddared'},
        {'id'=> 3, 'label'=> 'cauliflower'},
        {'id'=> 4, 'label'=> 'sour cream'},
        {'id'=> 5, 'label'=> 'cream of chicken'},
      ])
      expect(b1.settings['content_overrides']).to eq({ })
      expect(b2.settings['content_overrides']).to eq({
        'buttons' => {
          '5' => {
            'id' => 5,
            'label' => 'cream of chicken'
          },
          '3' => {
            'label' => 'cauliflower'
          }
        },
        'grid' => {
          'rows' => 3,
          'order' => [[1, 3], [5, 2], [nil, nil]]
        }
      })      
    end
  end

  describe "has_changes?" do
    it 'should return the correct value' do
      u = User.create
      b = Board.create(user: u)
      expect(BoardContent.has_changes?(b, b.board_content)).to eq(true)
      BoardContent.generate_from(b)
      expect(BoardContent.has_changes?(b, b.board_content)).to eq(false)
      b.settings['content_overrides'] = {
        'butttons' => {},
        'grid' => {}
      }
      expect(BoardContent.has_changes?(b, b.board_content)).to eq(false)
      b.settings['content_overrides'] = {
        'butttons' => {'a' => {}},
        'grid' => {}
      }
      expect(BoardContent.has_changes?(b, b.board_content)).to eq(true)
    end

    it 'should return false if override attributes exist only as empty collections' do
      u = User.create
      b = Board.create(user: u)
      BoardContent.generate_from(b)
      b.settings['content_overrides'] = {
        'butttons' => {},
        'grid' => {}
      }
      expect(BoardContent.has_changes?(b, b.board_content)).to eq(false)
      b.settings['content_overrides'] = {
        'butttons' => {'a' => {}},
        'grid' => {}
      }
      expect(BoardContent.has_changes?(b, b.board_content)).to eq(true)
    end
  end

  describe "track_differences" do
    it 'should do nothing but clear content_overrides without a content object' do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      b1.settings['content_overrides'] = {
        'buttons' => {
          '1' => {'label' => 'blech'}
        }
      }
      expect(BoardContent.track_differences(b1, nil)).to eq(true)
      expect(b1.settings['content_overrides']).to eq(nil)
      expect(b1.settings['buttons']).to_not eq(nil)
      expect(b1.settings['grid']).to_not eq(nil)
    end

    it 'should return false if called with the wrong content object' do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon'},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      b1.settings['content_overrides'] = {
        'buttons' => {
          '1' => {'label' => 'blech'}
        }
      }
      bc = BoardContent.create
      expect(BoardContent.track_differences(b1, bc)).to eq(false)
    end

    it 'should store only changed attributes on the content_overrides attr' do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon', translations: {'fr' => {'label' => 'oui'}}},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      }, background: {
        image: 'pic',
        prompt: 'hello'
      }, intro: {
        sections: ['a', 'b']
      })
      BoardContent.generate_from(b1)
      b1.process(buttons: [
        {id: 1, label: 'bakin', translations: {'fr' => {'label' => 'oui'}}},
        {id: 2, label: 'cheddar', translations: {'fr' => {'label' => 'non'}}},
        {id: 4, label: 'sour cream', 'vocalization' => 'sauer creme'},
        {id: 5, label: 'weeee'}
      ], grid: {
        rows: 2,
        columns: 3,
        order: [[1, 3], [2, 5]]
      }, background: 'delete', intro: {
        sections: ['a', 'b'],
        best: true
      })
      expect(b1.settings['content_overrides']).to eq({
        'buttons' => {
          "1"=>{"label"=>"bakin", "part_of_speech"=>nil, "suggested_part_of_speech"=>nil}, 
          "4"=>{"vocalization"=>"sauer creme", "part_of_speech"=>nil, "suggested_part_of_speech"=>nil}, 
          "5"=>{"id"=>5, "label"=>"weeee"}
        },
        'background' => nil,
        'intro' => {'best' => true},
        'grid' => {'columns' => 3, 'order' => [[1,3,nil],[2,5,nil]]},
        "translations" => {"2"=>{"fr"=>{"label"=>"non"}}},

      })
      expect(b1.buttons).to eq([{"id"=>1,
        "label"=>"bakin",
      },{
        "id"=>2,
        "label"=>"cheddar",
        "part_of_speech"=>"noun",
        "suggested_part_of_speech"=>"noun"
      }, {
        "id"=>3,
        "label"=>"broccoli",
        "part_of_speech"=>"noun",
        "suggested_part_of_speech"=>"noun"
      }, {
        "id"=>4,
        "label"=>"sour cream",
        "vocalization"=>"sauer creme"
      }, {
        "id"=>5, "label"=>"weeee"
      }])
      expect(BoardContent.load_content(b1, 'grid')).to eq({
        'rows' => 2,
        'columns' => 3,
        'order' => [[1,3,nil],[2,5,nil]]
      })
      expect(BoardContent.load_content(b1, 'intro')).to eq({
        'sections' => ['a', 'b'],
        'best' => true
      })
      expect(BoardContent.load_content(b1, 'background')).to eq(nil)
      expect(BoardContent.load_content(b1, 'translations')).to eq({
        '1' => {'fr' => {'label' => 'oui'}},
        '2' => {'fr' => {'label' => 'non'}}
      })
    end

    it 'should clear default attributes only if they are defined on the content object' do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon', translations: {'fr' => {'label' => 'oui'}}},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      BoardContent.generate_from(b1)
      b1.process(buttons: [
        {id: 1, label: 'bakin', translations: {'fr' => {'label' => 'oui'}}},
        {id: 2, label: 'cheddar', translations: {'fr' => {'label' => 'non'}}},
        {id: 4, label: 'sour cream', 'vocalization' => 'sauer creme'},
        {id: 5, label: 'weeee'}
      ], grid: {
        rows: 2,
        columns: 3,
        order: [[1, 3], [2, 5]]
        }, background: {
          image: 'pic',
          prompt: 'hello'
        }, intro: {
          sections: ['a', 'b']
      })
      expect(b1.settings['buttons']).to eq(nil)
      expect(b1.settings['grid']).to eq(nil)
      expect(b1.settings['intro']).to eq({
        'sections'=> ['a', 'b']
      })
      expect(b1.settings['background']).to eq({
        'image'=> 'pic',
        'prompt'=> 'hello'
      })
      expect(b1.settings['translations']).to eq(nil)
      expect(b1.settings['content_overrides']).to eq({
        'buttons' => {
          "1"=>{"label"=>"bakin", "part_of_speech"=>nil, "suggested_part_of_speech"=>nil}, 
          "4"=>{"vocalization"=>"sauer creme", "part_of_speech"=>nil, "suggested_part_of_speech"=>nil}, 
          "5"=>{"id"=>5, "label"=>"weeee"}
        },
        'grid' => {'columns' => 3, 'order' => [[1,3,nil],[2,5,nil]]},
        "translations" => {"2"=>{"fr"=>{"label"=>"non"}}},

      })
      expect(b1.buttons).to eq([{"id"=>1,
        "label"=>"bakin",
      },{
        "id"=>2,
        "label"=>"cheddar",
        "part_of_speech"=>"noun",
        "suggested_part_of_speech"=>"noun"
      }, {
        "id"=>3,
        "label"=>"broccoli",
        "part_of_speech"=>"noun",
        "suggested_part_of_speech"=>"noun"
      }, {
        "id"=>4,
        "label"=>"sour cream",
        "vocalization"=>"sauer creme"
      }, {
        "id"=>5, "label"=>"weeee"
      }])
      expect(BoardContent.load_content(b1, 'grid')).to eq({
        'rows' => 2,
        'columns' => 3,
        'order' => [[1,3,nil],[2,5,nil]]
      })
      expect(BoardContent.load_content(b1, 'intro')).to eq({
        'sections' => ['a', 'b']
      })
      expect(BoardContent.load_content(b1, 'background')).to eq({"image"=>"pic", "prompt"=>"hello"})
      expect(BoardContent.load_content(b1, 'translations')).to eq({
        '1' => {'fr' => {'label' => 'oui'}},
        '2' => {'fr' => {'label' => 'non'}}
      })
    end

    it "should allow hiding and showing a button" do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon', 'hidden' => false},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      BoardContent.generate_from(b1)
      b1.process(buttons: [
        {id: 1, label: 'bacon', 'hidden' => true},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      expect(b1.settings['content_overrides']).to eq({
        'buttons' => {
          "1"=>{"hidden"=>true}, 
        },
      })
      expect(b1.buttons).to eq([{"id"=>1,
        "label"=>"bacon",
        "hidden"=>true,
        "part_of_speech"=>"noun",
        "suggested_part_of_speech"=>"noun"
      },{
        "id"=>2,
        "label"=>"cheddar",
        "part_of_speech"=>"noun",
        "suggested_part_of_speech"=>"noun"
      }, {
        "id"=>3,
        "label"=>"broccoli",
        "part_of_speech"=>"noun",
        "suggested_part_of_speech"=>"noun"
      }, {
        "id"=>4,
        "label"=>"sour cream",
        "part_of_speech"=>"noun",
        "suggested_part_of_speech"=>"noun",
      }])

      b1.process(buttons: [
        {id: 1, label: 'bacon', 'hidden' => false},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })
      expect(b1.settings['content_overrides']).to eq({
        'buttons' => {
        },
      })
      b1.process(buttons: [
        {id: 1, label: 'bacon', 'hidden' => false},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      })

    end

    it 'should record cleared atttributes with a nil override' do
      u = User.create
      b1 = Board.create(user: u)
      b1.process(buttons: [
        {id: 1, label: 'bacon', translations: {'fr' => {'label' => 'oui'}}},
        {id: 2, label: 'cheddar'},
        {id: 3, label: 'broccoli'},
        {id: 4, label: 'sour cream', 'vocalization' => 'sauer creme'},
      ], grid: {
        rows: 2,
        columns: 2,
        order: [[1, 3], [2, 4]]
      }, background: {
        image: 'pic',
        prompt: 'hello'
      }, intro: {
        sections: ['a', 'b'],
        best: true
      })
      BoardContent.generate_from(b1)
      b1.process(buttons: [
        {id: 1, label: 'bakin'},
        {id: 2, label: 'cheddar', translations: {'fr' => {'label' => 'non'}}},
        {id: 4, label: 'sour cream'},
        {id: 5, label: 'weexe'}
      ], grid: {
        rows: 2,
        columns: 3,
        order: [[1, 3], [2, 5]]
      }, background: {
        prompt: 'hello',
        fast: true
      }, intro: {
        sections: ['a', 'b'],
        best: nil
      })

      expect(b1.settings['content_overrides']).to eq({
        'buttons' => {
          "1"=>{"label"=>"bakin", "part_of_speech"=>nil, "suggested_part_of_speech"=>nil}, 
          "4"=>{"vocalization"=>nil,"part_of_speech"=>"noun", "suggested_part_of_speech"=>"noun"}, 
          "5"=>{"id"=>5, "label"=>"weexe"}
        },
        'background' => {'image' => nil, 'fast' => true},
        'intro' => {'best' => nil},
        'grid' => {'columns' => 3, 'order' => [[1,3,nil],[2,5,nil]]},
        "translations" => {"2"=>{"fr"=>{"label"=>"non"}}},

      })
      expect(b1.buttons).to eq([{"id"=>1,
        "label"=>"bakin",
      },{
        "id"=>2,
        "label"=>"cheddar",
        "part_of_speech"=>"noun",
        "suggested_part_of_speech"=>"noun"
      }, {
        "id"=>3,
        "label"=>"broccoli",
        "part_of_speech"=>"noun",
        "suggested_part_of_speech"=>"noun"
      }, {
        "id"=>4,
        "label"=>"sour cream",
        "part_of_speech"=>"noun",
        "suggested_part_of_speech"=>"noun",
      }, {
        "id"=>5, "label"=>"weexe"
      }])
      expect(BoardContent.load_content(b1, 'grid')).to eq({
        'rows' => 2,
        'columns' => 3,
        'order' => [[1,3,nil],[2,5,nil]]
      })
      expect(BoardContent.load_content(b1, 'intro')).to eq({
        'sections' => ['a', 'b'],
      })
      expect(BoardContent.load_content(b1, 'background')).to eq({"fast"=>true, "prompt"=>"hello"})
      expect(BoardContent.load_content(b1, 'translations')).to eq({
        '1' => {'fr' => {'label' => 'oui'}},
        '2' => {'fr' => {'label' => 'non'}}
      })
    end
  end

  it "should not update an old clone when the source moves to a new content record" do
    u = User.create
    b1 = Board.create(user: u)
    b1.process(buttons: [
      {id: 1, label: 'bacon', translations: {'fr' => {'label' => 'oui'}}},
      {id: 2, label: 'cheddar'},
      {id: 3, label: 'broccoli'},
      {id: 4, label: 'sour cream'},
    ], grid: {
      rows: 2,
      columns: 2,
      order: [[1, 3], [2, 4]]
    }, background: {
      image: 'pic',
      prompt: 'hello'
    }, intro: {
      sections: ['a', 'b']
    })
    bc = BoardContent.generate_from(b1)
    b2 = Board.create(user: u)
    BoardContent.apply_clone(b1, b2, true)
    b2.save
    expect(b2.reload.board_content).to eq(bc)
    expect(b2.buttons).to eq([{"id"=>1,
      "label"=>"bacon",
      "part_of_speech"=>"noun",
      "suggested_part_of_speech"=>"noun"},
     {"id"=>2,
      "label"=>"cheddar",
      "part_of_speech"=>"noun",
      "suggested_part_of_speech"=>"noun"},
     {"id"=>3,
      "label"=>"broccoli",
      "part_of_speech"=>"noun",
      "suggested_part_of_speech"=>"noun"},
     {"id"=>4,
      "label"=>"sour cream",
      "part_of_speech"=>"noun",
      "suggested_part_of_speech"=>"noun"}])

    b1.process(buttons: [
      {id: 1, label: 'bakin', translations: {'fr' => {'label' => 'oui'}}},
      {id: 2, label: 'cheddar', translations: {'fr' => {'label' => 'non'}}},
      {id: 4, label: 'sour cream', 'vocalization' => 'sauer creme'},
      {id: 5, label: 'weeee'}
    ], grid: {
      rows: 2,
      columns: 3,
      order: [[1, 3], [2, 5]]
    }, background: 'delete', intro: {
      sections: ['a', 'b'],
      best: true
    })
    expect(b1.settings['content_overrides']).to eq({
      'buttons' => {
        "1"=>{"label"=>"bakin", "part_of_speech"=>nil, "suggested_part_of_speech"=>nil}, 
        "4"=>{"vocalization"=>"sauer creme", "part_of_speech"=>nil, "suggested_part_of_speech"=>nil}, 
        "5"=>{"id"=>5, "label"=>"weeee"}
      },
      'background' => nil,
      'intro' => {'best' => true},
      'grid' => {'columns' => 3, 'order' => [[1,3,nil],[2,5,nil]]},
      "translations" => {"2"=>{"fr"=>{"label"=>"non"}}},

    })
    expect(b1.buttons).to eq([{"id"=>1,
      "label"=>"bakin",
    },{
      "id"=>2,
      "label"=>"cheddar",
      "part_of_speech"=>"noun",
      "suggested_part_of_speech"=>"noun"
    }, {
      "id"=>3,
      "label"=>"broccoli",
      "part_of_speech"=>"noun",
      "suggested_part_of_speech"=>"noun"
    }, {
      "id"=>4,
      "label"=>"sour cream",
      "vocalization"=>"sauer creme"
    }, {
      "id"=>5, "label"=>"weeee"
    }])
    expect(BoardContent.load_content(b1, 'grid')).to eq({
      'rows' => 2,
      'columns' => 3,
      'order' => [[1,3,nil],[2,5,nil]]
    })
    expect(BoardContent.load_content(b1, 'intro')).to eq({
      'sections' => ['a', 'b'],
      'best' => true
    })
    expect(BoardContent.load_content(b1, 'background')).to eq(nil)
    expect(BoardContent.load_content(b1, 'translations')).to eq({
      '1' => {'fr' => {'label' => 'oui'}},
      '2' => {'fr' => {'label' => 'non'}}
    })
    expect(b2.reload.buttons).to eq([{"id"=>1,
      "label"=>"bacon",
      "part_of_speech"=>"noun",
      "suggested_part_of_speech"=>"noun"},
     {"id"=>2,
      "label"=>"cheddar",
      "part_of_speech"=>"noun",
      "suggested_part_of_speech"=>"noun"},
     {"id"=>3,
      "label"=>"broccoli",
      "part_of_speech"=>"noun",
      "suggested_part_of_speech"=>"noun"},
     {"id"=>4,
      "label"=>"sour cream",
      "part_of_speech"=>"noun",
      "suggested_part_of_speech"=>"noun"}])
  end
end
